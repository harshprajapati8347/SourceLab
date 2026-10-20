/// <reference types="vitest/globals" />
import assert from "node:assert/strict";
import { assembleCitations, pruneUnsupportedWebMarkers } from "./citations.js";
import type { TavilySearchResponse } from "../tavily.js";
import { keepUsableWebResults } from "../tavily.js";
import {
  acceptedResearchTopic,
  replaceUnauthorizedAnswer,
  retrievalDisposition,
  searchWebIfAllowed,
  settleWebSearch,
  shouldOfferWebResearch,
  WebSearchNotAuthorizedError,
} from "./web-search-policy.js";

const S3 = "How do I upload a document securely to Amazon S3 using Node.js?";
const OFFER = "Would you like me to perform web research on Software Engineering?";

const PAGES: TavilySearchResponse = {
  query: "s3 upload",
  results: [
    {
      title: "S3 docs",
      url: "https://docs.example/s3",
      content: "Upload with IAM and HTTPS.",
    },
    {
      title: "Bad",
      url: "javascript:alert(1)",
      content: "Ignore this page.",
    },
    {
      title: "Node guide",
      url: "https://guide.example/node",
      content: "The SDK example uses version 3.",
    },
  ],
};

describe("web search consent", () => {
  it("does not call the provider when consent is absent", async () => {
    let called = false;

    await assert.rejects(
      () =>
        searchWebIfAllowed({
          allowed: false,
          query: "corrective rewrite",
          search: async () => {
            called = true;
            return { query: "corrective rewrite", results: [] };
          },
        }),
      WebSearchNotAuthorizedError,
    );
    assert.equal(called, false);
  });

  it("does not let a previous yes authorize a new question", () => {
    const recentTurns = [
      `assistant: ${OFFER}`,
      "user: yes",
      "assistant: Software engineering is a discipline [W1].",
      `user: ${S3}`,
    ].join("\n");

    assert.equal(
      acceptedResearchTopic({
        userText: S3,
        recentTurns,
        webSearchEnabled: false,
      }),
      null,
    );
    assert.equal(
      acceptedResearchTopic({
        userText: S3,
        recentTurns,
        webSearchEnabled: true,
      }),
      null,
    );
  });

  it("authorizes a yes to the latest offer even when the toggle is off", () => {
    const recentTurns = [
      "user: What is Software Engineering?",
      `assistant: Your sources don't seem to cover Software Engineering. ${OFFER}`,
    ].join("\n");

    assert.equal(
      acceptedResearchTopic({
        userText: "Yes, search the web",
        recentTurns,
        webSearchEnabled: false,
      }),
      "Software Engineering",
    );
  });

  it("authorizes resending the offered topic only when the toggle is on", () => {
    const recentTurns = `assistant: ${OFFER}`;

    assert.equal(
      acceptedResearchTopic({
        userText: "What is Software Engineering?",
        recentTurns,
        webSearchEnabled: true,
      }),
      "Software Engineering",
    );
    assert.equal(
      acceptedResearchTopic({
        userText: "What is Software Engineering?",
        recentTurns,
        webSearchEnabled: false,
      }),
      null,
    );
  });

  it("asks for consent and does not search when workspace evidence is insufficient", async () => {
    assert.equal(
      retrievalDisposition({
        queryClass: "procedural",
        question: S3,
        chunkTexts: ["This notebook is about compilers."],
        sharesSubject: false,
      }),
      "ask-web",
    );

    let called = false;
    await assert.rejects(
      () =>
        searchWebIfAllowed({
          allowed: false,
          query: S3,
          search: async () => {
            called = true;
            return { query: S3, results: [] };
          },
        }),
      WebSearchNotAuthorizedError,
    );
    assert.equal(called, false);
  });

  it("answers when the passages contain the question even if coverage is low", () => {
    assert.equal(
      retrievalDisposition({
        queryClass: "simple_factual",
        question: "What encryption standard is used for data at rest?",
        chunkTexts: [
          "The encryption standard used for data at rest is AES-256.",
        ],
        sharesSubject: true,
      }),
      "answer",
    );
  });

  it("answers from workspace evidence without asking for web search", () => {
    assert.equal(
      retrievalDisposition({
        queryClass: "simple_factual",
        question: "What encryption standard is used for data at rest?",
        chunkTexts: ["The encryption standard used for data at rest is AES-256."],
        sharesSubject: true,
      }),
      "answer",
    );
  });

  it("keeps a missing fact inside the notebook on the insufficient-evidence path", () => {
    assert.equal(
      retrievalDisposition({
        queryClass: "simple_factual",
        question: "What is NovaDesk's annual enterprise contract price?",
        chunkTexts: ["NovaDesk is a workspace product."],
        sharesSubject: true,
      }),
      "missing-fact",
    );
  });

  it("asks when an overview has no passages", () => {
    assert.equal(
      retrievalDisposition({
        queryClass: "summarization",
        question: "Summarize the notebook",
        chunkTexts: [],
        sharesSubject: false,
      }),
      "ask-web",
    );
    assert.equal(
      retrievalDisposition({
        queryClass: "summarization",
        question: "Summarize the notebook",
        chunkTexts: ["A passage from the notebook."],
        sharesSubject: true,
      }),
      "answer",
    );
  });

  it("does not offer web search when the passages already contain the question", () => {
    assert.equal(
      shouldOfferWebResearch({
        evidenceSufficient: true,
        conversational: false,
        researchTopic: null,
      }),
      false,
    );
  });

  it("offers web search from evidence sufficiency, not from the draft wording", () => {
    assert.equal(
      shouldOfferWebResearch({
        evidenceSufficient: false,
        conversational: false,
        researchTopic: null,
      }),
      true,
    );
    assert.equal(
      shouldOfferWebResearch({
        evidenceSufficient: false,
        conversational: true,
        researchTopic: null,
      }),
      false,
    );
    assert.equal(
      shouldOfferWebResearch({
        evidenceSufficient: false,
        conversational: false,
        researchTopic: "Software Engineering",
      }),
      false,
    );
  });

  it("keeps a grounded reply that mentions a gap when the passages are sufficient", () => {
    const answer = "The workspace sources do not specify a second encryption mode [1].";
    assert.equal(
      replaceUnauthorizedAnswer({
        answer,
        searchAllowed: false,
        chunkCount: 1,
        withheld: true,
        conversational: false,
        evidenceSufficient: true,
        topic: "Encryption mode",
        focus: "Security",
      }),
      answer,
    );
  });

  it("preserves title and URL when search is approved", async () => {
    const results = await searchWebIfAllowed({
      allowed: true,
      query: "s3 upload",
      search: async () => PAGES,
    });

    assert.equal(results.results[0]?.title, "S3 docs");
    assert.equal(results.results[0]?.url, "https://docs.example/s3");
    const settled = settleWebSearch({
      topic: "S3 upload",
      results,
      failed: false,
    });
    assert.equal(settled.directReply, null);
    assert.equal(settled.webResults?.results[0]?.url, "https://docs.example/s3");
    assert.equal(settled.webResults?.results[1]?.url, "https://guide.example/node");
  });

  it("returns a failure reply and no citations when search is empty or throws", async () => {
    const empty = settleWebSearch({
      topic: "S3 upload",
      results: { query: "S3 upload", results: [] },
      failed: false,
    });
    assert.match(empty.directReply ?? "", /couldn't find web results/);
    assert.equal(empty.webResults, null);

    const failed = settleWebSearch({
      topic: "S3 upload",
      results: null,
      failed: true,
    });
    assert.match(failed.directReply ?? "", /couldn't complete web research/);
    assert.equal(failed.webResults, null);

    await assert.rejects(() =>
      searchWebIfAllowed({
        allowed: true,
        query: "S3 upload",
        search: async () => {
          throw new Error("provider down");
        },
      }),
    );
  });

  it("does not keep an uncited draft when search was allowed but nothing was cited", () => {
    const released = replaceUnauthorizedAnswer({
      answer: "Install aws-sdk and upload the object with server-side encryption.",
      searchAllowed: true,
      chunkCount: 0,
      withheld: false,
      conversational: false,
      topic: S3,
      focus: null,
    });

    assert.match(released, /couldn't complete web research/);
    assert.doesNotMatch(released, /aws-sdk/);
  });

  it("replaces a parametric how-to when no passage supports it", () => {
    const released = replaceUnauthorizedAnswer({
      answer:
        "Install aws-sdk and upload the object with server-side encryption and IAM permissions.",
      searchAllowed: false,
      chunkCount: 0,
      withheld: false,
      conversational: false,
      topic: S3,
      focus: "Compilers",
    });

    assert.match(released, /Would you like me to perform web research/);
    assert.doesNotMatch(released, /aws-sdk/);
  });
});

describe("web citation integrity", () => {
  it("drops results that lack a valid http(s) URL", () => {
    const usable = keepUsableWebResults(PAGES.results);
    assert.deepEqual(
      usable.map((result) => result.url),
      ["https://docs.example/s3", "https://guide.example/node"],
    );
  });

  it("maps each web marker to its own URL and omits unsupported pages", () => {
    const usable = keepUsableWebResults(PAGES.results);
    const answer = "Upload with IAM [W1]. The SDK example uses version 3 [W2].";
    const citations = assembleCitations({
      chunks: [
        {
          sourceTitle: "Notes",
          sourceType: "PDF",
          excerpt: "Compilers translate source code.",
        },
      ],
      webResults: { ...PAGES, results: usable },
      answer,
    });
    const web = citations.filter((citation) => citation.sourceType === "WEB");

    assert.equal(web.length, 2);
    assert.equal(web[0]?.url, "https://docs.example/s3");
    assert.equal(web[0]?.cited, true);
    assert.equal(web[1]?.url, "https://guide.example/node");
    assert.equal(web[1]?.cited, true);
    assert.equal(
      citations.some((citation) => citation.url?.startsWith("javascript:")),
      false,
    );
    assert.equal(web[0]?.sourceType, "WEB");
    assert.equal(typeof web[0]?.url, "string");
  });

  it("does not cite a page that does not support the claim", () => {
    const usable = keepUsableWebResults(PAGES.results);
    const pruned = pruneUnsupportedWebMarkers(
      "Upload with IAM [W1]. The limit is 99 [W2]. The notebook mentions compilers.",
      usable,
    );
    const citations = assembleCitations({
      chunks: [],
      webResults: { ...PAGES, results: usable },
      answer: pruned,
    });
    const web = citations.filter((citation) => citation.sourceType === "WEB");

    assert.match(pruned, /\[W1\]/);
    assert.doesNotMatch(pruned, /\[W2\]/);
    assert.doesNotMatch(pruned, /99/);
    assert.equal(web[0]?.cited, true);
    assert.equal(web[1]?.cited, false);
    assert.equal(
      pruneUnsupportedWebMarkers(
        "The official price is listed on the pricing page.",
        usable,
      ),
      "The official price is listed on the pricing page.",
    );
  });
});
