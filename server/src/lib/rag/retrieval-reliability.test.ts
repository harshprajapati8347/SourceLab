/// <reference types="vitest/globals" />
import assert from "node:assert/strict";
import { RAG_MERGED_CHUNK_CAP } from "../ai-config.js";
import type { EnrichedChunk } from "./authority.js";
import { compressChunks } from "./context-intelligence.js";
import {
  correctionDecision,
  gateScore,
  type QualityDimensions,
} from "./retrieval-quality.js";
import { capChunks, buildChatSystemPrompt, type RetrievedChunk } from "./retrieve.js";
import { missingRetrievalTerms } from "./topic-gap.js";

describe("retrieval reliability", () => {
  it("keeps a relevant older chunk ahead of a fresher weaker one", () => {
    const relevant = enriched({
      chunkId: "relevant",
      text: "The encryption standard used for data at rest is AES-256.",
      score: 0.9,
      freshness: 0.2,
      authorityWeight: 0.7,
    });
    const recent = enriched({
      chunkId: "recent",
      text: "Keys rotate every 90 days.",
      score: 0.4,
      freshness: 1,
      authorityWeight: 0.5,
    });

    const ordered = compressChunks([recent, relevant], new Set(), 8000);
    assert.equal(ordered[0]?.chunkId, "relevant");
    assert.equal(ordered[1]?.chunkId, "recent");

    const prompt = buildChatSystemPrompt({ chunks: ordered });
    assert.ok(prompt.indexOf("AES-256") < prompt.indexOf("90 days"));
  });

  it("pins a lexical chunk that vector ranking would drop", () => {
    const vector = Array.from({ length: RAG_MERGED_CHUNK_CAP + 2 }, (_, index) =>
      chunk({
        chunkId: `vector-${index}`,
        score: 0.9 - index * 0.01,
        text: `Unrelated passage ${index}`,
      }),
    );
    const lexical = chunk({
      chunkId: "rotation",
      score: 0.35,
      text: "The key rotation period is 90 days.",
    });

    const unpinned = capChunks([...vector, lexical]);
    assert.equal(
      unpinned.some((item) => item.chunkId === "rotation"),
      false,
    );

    const pinned = capChunks([...vector, lexical], new Set(["rotation"]));
    assert.equal(
      pinned.some((item) => item.chunkId === "rotation"),
      true,
    );
  });

  it("names the terms a vector hit failed to include", () => {
    assert.deepEqual(
      missingRetrievalTerms("What is the key rotation period?", [
        "The encryption standard is AES-256.",
      ]),
      ["rotation", "period"],
    );
  });

  it("does not correct when only freshness and authority are low", () => {
    const dimensions: QualityDimensions = {
      relevance: 0.5,
      coverage: 0.9,
      freshness: 0,
      authority: 0.1,
      duplication: 0.5,
    };

    assert.ok(gateScore(dimensions) < 0.55);
    assert.equal(correctionDecision(false, dimensions), "use-evidence");
  });

  it("retrieves once for low coverage and then stops", () => {
    const dimensions: QualityDimensions = {
      relevance: 0.8,
      coverage: 0.2,
      freshness: 1,
      authority: 1,
      duplication: 1,
    };

    assert.equal(correctionDecision(false, dimensions), "retrieve");
    assert.equal(correctionDecision(true, dimensions), "exhausted");
  });

  it("keeps both sides of a conflict and prefers the newer source", () => {
    const older = chunk({
      chunkId: "older",
      text: "The Pro source limit is 50 as of June 2025.",
      score: 0.8,
      authority: "user_uploaded",
      authorityWeight: 0.7,
      indexedAt: "2025-06-01",
    });
    const newer = chunk({
      chunkId: "newer",
      text: "The Pro source limit is 100 as of January 2026.",
      score: 0.7,
      authority: "official_policy",
      authorityWeight: 1,
      indexedAt: "2026-01-01",
    });
    const prompt = buildChatSystemPrompt({
      chunks: [older, newer],
      contradictions: [
        {
          summary: "The Pro source limit differs.",
          chunkIds: ["older", "newer"],
          webUrls: [],
        },
      ],
    });

    assert.match(prompt, /The Pro source limit is 50/);
    assert.match(prompt, /The Pro source limit is 100/);
    assert.match(prompt, /Prefer the newer, higher-authority source/);
  });

  it("states both values when the question names two numbers", () => {
    const prompt = buildChatSystemPrompt({
      chunks: [
        chunk({
          chunkId: "older",
          text: "The Pro source limit is 50 as of June 2025.",
        }),
      ],
      stateBothSides: true,
    });

    assert.match(prompt, /State each value with the date/);
    assert.match(prompt, /Do not answer with only the newer value/);
  });
});

function chunk(
  partial: Partial<RetrievedChunk> & Pick<RetrievedChunk, "chunkId">,
): RetrievedChunk {
  return {
    sourceId: "source",
    sourceTitle: "Notes",
    sourceType: "TEXT",
    chunkIndex: 0,
    text: partial.chunkId,
    score: 0.8,
    ...partial,
  };
}

function enriched(
  partial: Pick<EnrichedChunk, "chunkId" | "text" | "score" | "freshness"> &
    Partial<EnrichedChunk>,
): EnrichedChunk {
  return {
    sourceId: "source",
    sourceTitle: "Notes",
    sourceType: "TEXT",
    chunkIndex: 0,
    authority: "user_uploaded",
    authorityWeight: 0.7,
    ...partial,
  };
}
