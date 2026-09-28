/**
 * Retrieval-quality gate.
 *
 * Relevance, freshness, authority, and duplication are computed in code.
 * Coverage and contradiction share one structured model call when more than
 * one piece of evidence is present. Contradiction is reported and excluded
 * from the gate average.
 */

import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";
import {
  AUTHORITY_WEIGHTS,
  type EnrichedChunk,
} from "./authority.js";
import {
  RAG_DEDUP_THRESHOLD,
  RAG_INTELLIGENCE_MODEL,
  RAG_NEUTRAL_FRESHNESS,
} from "../ai-config.js";
import {
  deduplicateChunks,
  embedChunksForDedup,
} from "./context-intelligence.js";
import { logRagEvent } from "./rag-log.js";

export type Contradiction = {
  summary: string;
  chunkIds: string[];
  webUrls: string[];
};

export type WebSnippet = {
  title: string;
  url: string;
  content: string;
  score: number;
};

export type QualityDimensions = {
  relevance: number;
  coverage: number;
  freshness: number;
  authority: number;
  duplication: number;
};

export type RetrievalQuality = {
  gateScore: number;
  dimensions: QualityDimensions;
  contradictions: Contradiction[];
  uniqueChunks: EnrichedChunk[];
  removedDuplicates: number;
  judgementFailed: boolean;
  dedupFailed: boolean;
};

const judgementSchema = z.object({
  coverage: z.number().min(0).max(1),
  contradictions: z.array(
    z.object({
      summary: z.string(),
      references: z.array(z.string()),
    }),
  ),
});

/**
 * Scores a retrieval set and drops semantic duplicates before the judgement call.
 *
 * When the judgement call fails, coverage falls back to the relevance score and
 * no contradictions are reported. The gate still uses the deterministic dimensions.
 *
 * @param input - User question, enriched chunks, and optional web snippets
 * @returns Gate score, dimensions, contradictions, and the deduplicated chunks
 */
export async function evaluateRetrievalQuality(input: {
  query: string;
  chunks: EnrichedChunk[];
  webSnippets?: WebSnippet[];
}): Promise<RetrievalQuality> {
  const webSnippets = dedupeWebSnippets(input.webSnippets ?? []);
  const embeddings = await embedChunksForDedup(input.chunks);
  const deduped =
    embeddings.length === input.chunks.length
      ? deduplicateChunks(input.chunks, embeddings, RAG_DEDUP_THRESHOLD)
      : { unique: input.chunks, removedCount: 0 };

  if (embeddings.length !== input.chunks.length && input.chunks.length > 0) {
    logRagEvent("context", { dedupFailed: true });
  }

  const uniqueChunks = deduped.unique;
  const relevance = mean([
    ...uniqueChunks.map((chunk) => clamp01(chunk.score)),
    ...webSnippets.map((snippet) => clamp01(snippet.score)),
  ]);
  const freshness = mean([
    ...uniqueChunks.map((chunk) => chunk.freshness),
    ...webSnippets.map(() => RAG_NEUTRAL_FRESHNESS),
  ]);
  const authority = mean([
    ...uniqueChunks.map((chunk) => chunk.authorityWeight),
    ...webSnippets.map(() => AUTHORITY_WEIGHTS.web),
  ]);
  const duplication =
    input.chunks.length === 0
      ? 1
      : 1 - deduped.removedCount / input.chunks.length;
  const evidenceCount = uniqueChunks.length + webSnippets.length;
  const judged =
    evidenceCount > 1
      ? await judgeEvidence(input.query, uniqueChunks, webSnippets, relevance)
      : {
          coverage: evidenceCount === 1 ? 1 : 0,
          contradictions: [] as Contradiction[],
          judgementFailed: false,
        };

  const dimensions = {
    relevance,
    coverage: judged.coverage,
    freshness,
    authority,
    duplication,
  };

  return {
    gateScore: gateScore(dimensions),
    dimensions,
    contradictions: judged.contradictions,
    uniqueChunks,
    removedDuplicates: deduped.removedCount,
    judgementFailed: judged.judgementFailed,
    dedupFailed: input.chunks.length > 0 && embeddings.length !== input.chunks.length,
  };
}

/**
 * Equal average of the five gate dimensions.
 *
 * @param dimensions - Scores from 0 to 1
 * @returns Gate score from 0 to 1
 */
export function gateScore(dimensions: QualityDimensions) {
  return (
    (clamp01(dimensions.relevance) +
      clamp01(dimensions.coverage) +
      clamp01(dimensions.freshness) +
      clamp01(dimensions.authority) +
      clamp01(dimensions.duplication)) /
    5
  );
}

async function judgeEvidence(
  query: string,
  chunks: EnrichedChunk[],
  webSnippets: WebSnippet[],
  fallbackCoverage: number,
) {
  try {
    const result = await generateText({
      model: openai(RAG_INTELLIGENCE_MODEL),
      output: Output.object({ schema: judgementSchema }),
      system: [
        "You judge whether the evidence covers the question and whether sources contradict each other.",
        "coverage is 0 when the evidence misses the question and 1 when it covers it.",
        "Report a contradiction only when two sources make incompatible factual claims.",
        "references must use the labels in the evidence, such as [1] or [W1].",
        "Do not resolve a contradiction or answer the question.",
      ].join("\n"),
      prompt: `Question:\n${query}\n\nEvidence:\n${formatEvidence(chunks, webSnippets)}`,
    });

    if (!result.output) {
      throw new Error("Retrieval judgement returned no output");
    }

    return {
      coverage: clamp01(result.output.coverage),
      contradictions: result.output.contradictions
        .map((conflict) =>
          mapContradiction(conflict, chunks, webSnippets),
        )
        .filter(
          (conflict) =>
            conflict.summary &&
            (conflict.chunkIds.length > 0 || conflict.webUrls.length > 0),
        ),
      judgementFailed: false,
    };
  } catch {
    logRagEvent("quality", { judgementFailed: true });
    return {
      coverage: fallbackCoverage,
      contradictions: [] as Contradiction[],
      judgementFailed: true,
    };
  }
}

function mapContradiction(
  conflict: { summary: string; references: string[] },
  chunks: EnrichedChunk[],
  webSnippets: WebSnippet[],
): Contradiction {
  const chunkIds: string[] = [];
  const webUrls: string[] = [];

  for (const reference of conflict.references) {
    const chunkMatch = /^\[(\d+)\]$/.exec(reference.trim());
    if (chunkMatch) {
      const chunk = chunks[Number(chunkMatch[1]) - 1];
      if (chunk) {
        chunkIds.push(chunk.chunkId);
      }
      continue;
    }

    const webMatch = /^\[W(\d+)\]$/i.exec(reference.trim());
    if (webMatch) {
      const snippet = webSnippets[Number(webMatch[1]) - 1];
      if (snippet) {
        webUrls.push(snippet.url);
      }
    }
  }

  return {
    summary: conflict.summary.trim(),
    chunkIds,
    webUrls,
  };
}

function formatEvidence(chunks: EnrichedChunk[], webSnippets: WebSnippet[]) {
  const chunkBlocks = chunks.map((chunk, index) => {
    return `[${index + 1}] ${chunk.sourceTitle} (${chunk.sourceType})\n${chunk.text.slice(0, 1500)}`;
  });
  const webBlocks = webSnippets.map((snippet, index) => {
    return `[W${index + 1}] ${snippet.title} (${snippet.url})\n${snippet.content.slice(0, 1500)}`;
  });

  return [...chunkBlocks, ...webBlocks].join("\n\n");
}

function dedupeWebSnippets(snippets: WebSnippet[]) {
  const seen = new Set<string>();
  const unique: WebSnippet[] = [];

  for (const snippet of snippets) {
    if (!snippet.url || seen.has(snippet.url)) {
      continue;
    }

    seen.add(snippet.url);
    unique.push(snippet);
  }

  return unique;
}

function mean(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp01(value: number) {
  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}
