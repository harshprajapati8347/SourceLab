/// <reference types="vitest/globals" />
import assert from "node:assert/strict";
import {
  correctiveRetrievalQueries,
  routeQuery,
  sanitizeRetrievalQuery,
} from "./query-intelligence.js";

describe("retrieval queries", () => {
  it("searches for missing fields without asking the search to infer them", () => {
    const query = sanitizeRetrievalQuery(
      "Retrieve customer contact details including city, company, email address, and phone number while inferring missing data.",
    );

    assert.equal(
      query,
      "Retrieve customer contact details including city, company, email address, and phone number.",
    );
    assert.doesNotMatch(query, /infer/i);
  });

  it("keeps a rewritten search query free of inference instructions", () => {
    const routed = routeQuery("What are the customer contact details?", {
      queryClass: "simple_factual",
      dependsOnHistory: true,
      rewrittenQuery:
        "Retrieve customer contact details including city, company, email address, and phone number while inferring missing data.",
      subqueries: ["Infer the missing company from the email"],
    });

    assert.equal(
      routed.rewrittenQuery,
      "Retrieve customer contact details including city, company, email address, and phone number.",
    );
    assert.ok(
      routed.queries.every((query) => !/infer/i.test(query)),
      routed.queries.join(" | "),
    );
    assert.ok(
      routed.subqueries.every((query) => !/infer/i.test(query)),
      routed.subqueries.join(" | "),
    );
  });

  it("searches the workspace before treating a question as outside the notebook", () => {
    const routed = routeQuery("What is Software Engineering?", {
      queryClass: "out_of_domain",
      dependsOnHistory: false,
      rewrittenQuery: "Software Engineering",
      subqueries: [],
    });

    assert.equal(routed.skipRetrieval, false);
    assert.deepEqual(routed.queries, ["Software Engineering"]);
  });

  it("searches a standalone factual question without a hypothetical passage", () => {
    const routed = routeQuery("What encryption standard is used?", {
      queryClass: "simple_factual",
      dependsOnHistory: false,
      rewrittenQuery: "encryption standard",
      subqueries: [],
    });

    assert.deepEqual(routed.queries, ["What encryption standard is used?"]);
    assert.equal(routed.useHyde, false);
    assert.deepEqual(routed.transforms, []);
  });

  it("keeps the original question beside decomposed sub-questions", () => {
    const routed = routeQuery("How does billing relate to encryption?", {
      queryClass: "multi_hop",
      dependsOnHistory: false,
      rewrittenQuery: "billing and encryption",
      subqueries: [
        "What is the billing model?",
        "What encryption standard is used?",
      ],
    });

    assert.equal(routed.useHyde, false);
    assert.ok(
      routed.queries.includes("How does billing relate to encryption?"),
    );
    assert.ok(routed.queries.includes("What is the billing model?"));
    assert.ok(routed.queries.includes("What encryption standard is used?"));
  });

  it("discards a corrective rewrite that drops the original terms", () => {
    const corrected = correctiveRetrievalQueries({
      userText: "What encryption standard is used for data at rest?",
      rewrittenQuery: "How are files protected?",
      expansions: ["security approach"],
      missingTerms: ["encryption", "standard"],
    });

    assert.equal(corrected.droppedRewrite, true);
    assert.equal(
      corrected.retrievalQueries[0],
      "What encryption standard is used for data at rest?",
    );
    assert.equal(
      corrected.retrievalQueries.includes("How are files protected?"),
      false,
    );
    assert.ok(
      corrected.retrievalQueries.some((query) => query.includes("encryption")),
    );
  });
});
