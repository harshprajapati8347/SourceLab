import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { routeQuery, sanitizeRetrievalQuery } from "./query-intelligence.js";

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
});
