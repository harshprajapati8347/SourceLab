import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeOverviewChunks,
  selectOverviewChunks,
  type RetrievedChunk,
} from "./retrieve.js";

function chunk(partial: Partial<RetrievedChunk> & Pick<RetrievedChunk, "chunkId">): RetrievedChunk {
  return {
    sourceId: "source",
    sourceTitle: "Notes",
    sourceType: "TEXT",
    chunkIndex: 0,
    text: partial.chunkId,
    score: 0.35,
    ...partial,
  };
}

describe("overview retrieval", () => {
  it("takes one opening chunk from each source before a second chunk", () => {
    const result = selectOverviewChunks(
      [
        {
          id: "s1",
          title: "One",
          type: "TEXT",
          chunks: [
            { id: "c1", index: 0, content: "aaaa", metadata: { page: 1 } },
            { id: "c2", index: 1, content: "bbbb", metadata: null },
          ],
        },
        {
          id: "s2",
          title: "Two",
          type: "PDF",
          chunks: [
            { id: "c3", index: 0, content: "cccc", metadata: { page: 4 } },
          ],
        },
      ],
      1000,
    );

    assert.deepEqual(result.pinnedIds, ["c1", "c3"]);
    assert.deepEqual(
      result.chunks.map((item) => item.chunkId),
      ["c1", "c3", "c2"],
    );
    assert.equal(result.chunks[0]?.page, 1);
    assert.equal(result.chunks[1]?.page, 4);
  });

  it("stops extra chunks at the character budget", () => {
    const result = selectOverviewChunks(
      [
        {
          id: "s1",
          title: "One",
          type: "TEXT",
          chunks: [
            { id: "c1", index: 0, content: "aaaa", metadata: null },
            { id: "c2", index: 1, content: "bbbbbbbb", metadata: null },
          ],
        },
      ],
      6,
    );

    assert.deepEqual(
      result.chunks.map((item) => item.chunkId),
      ["c1"],
    );
  });

  it("keeps a higher semantic score and appends new hits", () => {
    const merged = mergeOverviewChunks(
      [chunk({ chunkId: "c1", score: 0.35, text: "opening" })],
      [
        chunk({ chunkId: "c1", score: 0.9, text: "opening" }),
        chunk({ chunkId: "c9", score: 0.8, text: "specific" }),
      ],
    );

    assert.equal(merged[0]?.chunkId, "c1");
    assert.equal(merged[0]?.score, 0.9);
    assert.equal(merged[1]?.chunkId, "c9");
  });
});
