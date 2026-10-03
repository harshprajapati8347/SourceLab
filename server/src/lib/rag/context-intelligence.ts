/**
 * Semantic deduplication and extractive context compression.
 *
 * Chunk text stays verbatim so citations still match the indexed source.
 */

import { RAG_DEDUP_EMBED_CHARS } from "../ai-config.js";
import { embedTexts } from "../openai.js";
import type { EnrichedChunk } from "./authority.js";
import { textsStateDistinctFacts } from "./request-disposition.js";

/**
 * Cosine similarity of two equal-length embedding vectors.
 *
 * @param left - First embedding
 * @param right - Second embedding
 * @returns Similarity from -1 to 1, or 0 when either vector has no magnitude
 */
export function cosineSimilarity(left: number[], right: number[]) {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

/**
 * Drops near-duplicate chunks, keeping the higher-authority, then fresher, then higher-scoring copy.
 *
 * When `preserveDistinctFacts` is set, a near-duplicate that states a different
 * number or month-year is kept. Other questions still drop the older copy.
 *
 * @param chunks - Enriched chunks in any order
 * @param embeddings - Embeddings aligned by index with `chunks`
 * @param threshold - Cosine similarity that marks a duplicate
 * @param options - Set `preserveDistinctFacts` for an explicit value conflict
 * @returns Kept chunks and how many were removed
 */
export function deduplicateChunks(
  chunks: EnrichedChunk[],
  embeddings: number[][],
  threshold: number,
  options?: { preserveDistinctFacts?: boolean },
) {
  const order = chunks
    .map((_, index) => index)
    .sort((left, right) => compareChunkPriority(chunks[left], chunks[right]));
  const kept: number[] = [];

  for (const index of order) {
    const embedding = embeddings[index];
    if (!embedding) {
      kept.push(index);
      continue;
    }

    const duplicate = kept.some((keptIndex) => {
      const keptEmbedding = embeddings[keptIndex];
      if (!keptEmbedding) {
        return false;
      }

      if (cosineSimilarity(embedding, keptEmbedding) < threshold) {
        return false;
      }

      if (
        options?.preserveDistinctFacts &&
        textsStateDistinctFacts(chunks[index].text, chunks[keptIndex].text)
      ) {
        return false;
      }

      return true;
    });

    if (!duplicate) {
      kept.push(index);
    }
  }

  return {
    unique: kept.map((index) => chunks[index]),
    removedCount: chunks.length - kept.length,
  };
}

/**
 * Embeds chunk text for deduplication. Failures return an empty list so callers can keep every chunk.
 *
 * @param chunks - Chunks about to be deduplicated
 * @returns Embeddings aligned with `chunks`, or `[]` when embedding fails
 */
export async function embedChunksForDedup(chunks: EnrichedChunk[]) {
  if (chunks.length === 0) {
    return [];
  }

  try {
    return await embedTexts(
      chunks.map((chunk) => chunk.text.slice(0, RAG_DEDUP_EMBED_CHARS)),
    );
  } catch {
    return [];
  }
}

/**
 * Orders chunks by relevance, authority, and freshness, then keeps text inside a character budget.
 *
 * Chunks listed in `pinnedIds` are always kept, even when they exceed the budget,
 * so conflicting evidence is not dropped.
 *
 * @param chunks - Deduplicated chunks
 * @param pinnedIds - Chunk ids that must survive compression
 * @param budget - Maximum characters of unpinned chunk text
 * @returns Chunks that should enter the system prompt
 */
export function compressChunks(
  chunks: EnrichedChunk[],
  pinnedIds: Set<string>,
  budget: number,
) {
  const pinned = chunks
    .filter((chunk) => pinnedIds.has(chunk.chunkId))
    .sort(compareChunkRank);
  const rest = chunks
    .filter((chunk) => !pinnedIds.has(chunk.chunkId))
    .sort(compareChunkRank);
  const selected: EnrichedChunk[] = [];
  let used = 0;

  for (const chunk of pinned) {
    selected.push(chunk);
    used += chunk.text.length;
  }

  for (const chunk of rest) {
    if (used >= budget && selected.length > 0) {
      break;
    }

    selected.push(chunk);
    used += chunk.text.length;

    if (used >= budget) {
      break;
    }
  }

  return selected.sort(compareChunkRank);
}

function compareChunkPriority(left: EnrichedChunk, right: EnrichedChunk) {
  return (
    right.authorityWeight - left.authorityWeight ||
    right.freshness - left.freshness ||
    right.score - left.score
  );
}

function compareChunkRank(left: EnrichedChunk, right: EnrichedChunk) {
  return chunkRank(right) - chunkRank(left);
}

function chunkRank(chunk: EnrichedChunk) {
  return chunk.score * chunk.authorityWeight * chunk.freshness;
}
