/**
 * Chat retrieval pipeline: classify, retrieve, score, correct, then compress.
 *
 * `streamText` stays in the chat service. This module only prepares the
 * context that the system prompt and citations are built from.
 */

import {
  RAG_CONTEXT_CHAR_BUDGET,
  RAG_CORRECTIVE_MIN_SCORE,
  RAG_DEDUP_THRESHOLD,
  RAG_NEUTRAL_FRESHNESS,
  RAG_QUALITY_GATE,
} from "../lib/ai-config.js";
import {
  enrichChunksWithSources,
  authorityLabel,
  type EnrichedChunk,
} from "../lib/rag/authority.js";
import {
  compressChunks,
  deduplicateChunks,
  embedChunksForDedup,
} from "../lib/rag/context-intelligence.js";
import {
  planCorrectiveQueries,
  planQuery,
  type QueryClass,
  type QueryPlan,
  type QueryTransform,
} from "../lib/rag/query-intelligence.js";
import { createRagTrace, type RagTrace, type RagTraceRecorder } from "../lib/rag/rag-trace.js";
import { logRagEvent } from "../lib/rag/rag-log.js";
import {
  capChunks,
  mergeRetrievedChunks,
  retrieveMergedWorkspaceContext,
  retrieveWorkspaceContext,
  type RetrievedChunk,
} from "../lib/rag/retrieve.js";
import {
  evaluateRetrievalQuality,
  type Contradiction,
  type RetrievalQuality,
  type WebSnippet,
} from "../lib/rag/retrieval-quality.js";
import { findSourcesByIds } from "../repositories/source.repository.js";
import {
  searchWeb,
  type TavilySearchResponse,
} from "../lib/tavily.js";

export type RagPipelineResult = {
  chunks: EnrichedChunk[];
  contradictions: Contradiction[];
  gateScore: number;
  weakEvidence: boolean;
  webResults: TavilySearchResponse | null;
  queryClass: QueryClass;
  transforms: QueryTransform[];
  trace: RagTrace;
};

/**
 * Runs query and context intelligence for one workspace chat turn.
 *
 * Classification, HyDE, and coverage failures fall open to ordinary retrieval.
 * A low gate score runs one rewrite-and-expand pass, then Tavily only when
 * web search is already enabled.
 *
 * @param input - Workspace, user text, conversation context, and web-search flag
 * @returns Chunks, conflicts, and web results ready for the system prompt
 */
export async function runRagPipeline(input: {
  workspaceId: string;
  userText: string;
  conversationSummary?: string | null;
  recentTurns?: string;
  webSearchEnabled: boolean;
  onTrace?: (trace: RagTrace) => void;
}): Promise<RagPipelineResult> {
  const trace = createRagTrace(input.onTrace);

  trace.step({
    id: "received",
    label: "Query received",
    status: "done",
    summary: "Latest user message",
    lines: [input.userText],
  });

  const plan = await planQuery({
    userText: input.userText,
    conversationSummary: input.conversationSummary,
    recentTurns: input.recentTurns,
    onProgress: (event) => {
      if (event === "classifying") {
        trace.step({
          id: "classified",
          label: "Classifying",
          status: "active",
          summary: "Detecting query type",
          lines: [],
        });
      }

      if (event === "hyde") {
        trace.step({
          id: "hyde",
          label: "HyDE",
          status: "active",
          summary: "Writing a hypothetical passage",
          lines: [],
        });
      }
    },
  });

  trace.step({
    id: "classified",
    label: "Classified",
    status: "done",
    summary: plan.usedFallback
      ? `${QUERY_CLASS_LABELS[plan.queryClass]} (fallback)`
      : QUERY_CLASS_LABELS[plan.queryClass],
    lines: [
      `Type: ${plan.queryClass}`,
      plan.fallbackReason
        ? `Fallback: ${plan.fallbackReason} failed, so the original message is used`
        : `Transforms: ${plan.transforms.join(", ") || "none"}`,
    ],
  });
  recordPlanSteps(trace, plan);

  if (plan.skipRetrieval) {
    trace.step({
      id: "retrieval",
      label: "Retrieving",
      status: "done",
      summary: "Workspace retrieval skipped",
      lines: [
        plan.queryClass === "conversational"
          ? "Conversational messages are not searched."
          : "Out-of-domain messages are not searched in the workspace.",
      ],
    });
    return finish(trace, {
      chunks: [],
      contradictions: [],
      gateScore: 1,
      weakEvidence: false,
      webResults: null,
      queryClass: plan.queryClass,
      transforms: plan.transforms,
    });
  }

  trace.step({
    id: "retrieval",
    label: "Retrieving",
    status: "active",
    summary: plan.usedFallback
      ? "Original message"
      : `${plan.retrievalQueries.length} search ${plan.retrievalQueries.length === 1 ? "query" : "queries"}`,
    lines: plan.retrievalQueries.map(previewQuery),
  });

  const retrieved = plan.usedFallback
    ? capChunks(
        await retrieveWorkspaceContext(input.workspaceId, input.userText),
      )
    : await retrieveMergedWorkspaceContext(
        input.workspaceId,
        plan.retrievalQueries,
      );

  trace.step({
    id: "retrieval",
    label: "Retrieving",
    status: "done",
    summary: `${retrieved.length} chunk${retrieved.length === 1 ? "" : "s"}`,
    lines: [
      ...plan.retrievalQueries.map((query, index) =>
        plan.hydePassage && query === plan.hydePassage
          ? `HyDE passage: ${previewQuery(query)}`
          : `Query ${index + 1}: ${previewQuery(query)}`,
      ),
      ...retrieved.map((chunk) => {
        const excerpt = chunk.text.replace(/\s+/g, " ").trim().slice(0, 120);
        return `${chunk.sourceTitle} (${chunk.sourceType}, score ${chunk.score.toFixed(2)}) — ${excerpt}`;
      }),
    ],
  });

  let enriched = await enrichChunks(input.workspaceId, retrieved);
  recordAuthority(trace, enriched);
  let transforms = [...plan.transforms];
  let webResults: TavilySearchResponse | null = null;

  if (plan.usedFallback) {
    const prepared = await compressWithoutGate(enriched);
    recordContext(trace, enriched, prepared.chunks, prepared.removed, []);
    return finish(trace, {
      chunks: prepared.chunks,
      contradictions: [],
      gateScore: 1,
      weakEvidence: false,
      webResults: null,
      queryClass: plan.queryClass,
      transforms,
    });
  }

  trace.step({
    id: "quality",
    label: "CRAG evaluation",
    status: "active",
    summary: "Scoring retrieved context",
    lines: [],
  });

  let scoredInput = enriched;
  let quality = await evaluateRetrievalQuality({
    query: input.userText,
    chunks: enriched,
  });
  if (quality.judgementFailed) {
    return plainRetrieval(input, plan, transforms, trace);
  }

  const initialGateScore = quality.gateScore;
  recordQuality(trace, quality, "Initial retrieval");

  if (quality.gateScore < RAG_QUALITY_GATE) {
    const corrective = await planCorrectiveQueries(input.userText, () => {
      trace.step({
        id: "expansion",
        label: "Query expansion",
        status: "active",
        summary: "Rewriting for another retrieval",
        lines: [],
      });
    });
    transforms = [...transforms, ...corrective.transforms];
    trace.step({
      id: "expansion",
      label: "Query expansion",
      status: "done",
      summary: corrective.rewrittenQuery,
      lines: corrective.retrievalQueries,
    });

    trace.step({
      id: "corrective-retrieval",
      label: "Corrective retrieval",
      status: "active",
      summary: "Searching again with a lower similarity floor",
      lines: corrective.retrievalQueries.map(previewQuery),
    });

    const extra = await retrieveMergedWorkspaceContext(
      input.workspaceId,
      corrective.retrievalQueries,
      { minScore: RAG_CORRECTIVE_MIN_SCORE },
    );
    const merged = capChunks(
      mergeRetrievedChunks([quality.uniqueChunks, extra]),
    );
    enriched = await enrichChunks(input.workspaceId, merged);
    recordAuthority(trace, enriched);
    scoredInput = enriched;
    quality = await evaluateRetrievalQuality({
      query: input.userText,
      chunks: enriched,
    });
    if (quality.judgementFailed) {
      return plainRetrieval(input, plan, transforms, trace);
    }

    trace.step({
      id: "corrective-retrieval",
      label: "Corrective retrieval",
      status: "done",
      summary: `${quality.uniqueChunks.length} chunks after merge`,
      lines: quality.uniqueChunks.map(describeChunk),
    });

    const cragLines = [
      `Triggered because the gate was ${formatScore(initialGateScore)}, below ${RAG_QUALITY_GATE}.`,
      `Rewrite: ${corrective.rewrittenQuery}`,
      ...corrective.retrievalQueries.map(previewQuery),
      `Gate after workspace retry: ${formatScore(quality.gateScore)}.`,
    ];

    if (quality.gateScore < RAG_QUALITY_GATE && input.webSearchEnabled) {
      try {
        trace.step({
          id: "crag",
          label: "CRAG",
          status: "active",
          summary: "Searching the web",
          lines: cragLines,
        });
        webResults = await searchWeb(corrective.rewrittenQuery);
        quality = await evaluateRetrievalQuality({
          query: input.userText,
          chunks: quality.uniqueChunks,
          webSnippets: toWebSnippets(webResults),
        });
        if (quality.judgementFailed) {
          return plainRetrieval(input, plan, plan.transforms, trace);
        }
        cragLines.push(
          `Web results: ${webResults.results.length}.`,
          `Gate after web search: ${formatScore(quality.gateScore)}.`,
        );
      } catch {
        cragLines.push("Web search failed. Continuing with workspace chunks.");
      }
    } else if (quality.gateScore < RAG_QUALITY_GATE) {
      cragLines.push(
        "Web search was not used because the toggle is off.",
        `Final gate: ${formatScore(quality.gateScore)}.`,
      );
    }

    trace.step({
      id: "crag",
      label: "CRAG",
      status: "done",
      summary:
        quality.gateScore < RAG_QUALITY_GATE
          ? `Still low at ${formatScore(quality.gateScore)}`
          : `Recovered at ${formatScore(quality.gateScore)}`,
      lines: cragLines,
    });
    recordQuality(trace, quality, "After corrective retrieval", "quality-final");
  } else {
    trace.step({
      id: "crag",
      label: "CRAG",
      status: "done",
      summary: `Not triggered — gate ${formatScore(initialGateScore)} is at least ${RAG_QUALITY_GATE}`,
      lines: [
        `Threshold: ${RAG_QUALITY_GATE}.`,
        "Normal generation uses the first retrieval.",
      ],
    });
  }

  const prepared = compressForPrompt(quality);
  const removed = scoredInput.filter(
    (chunk) =>
      !quality.uniqueChunks.some((kept) => kept.chunkId === chunk.chunkId),
  );
  recordContext(
    trace,
    scoredInput,
    prepared.chunks,
    removed,
    quality.contradictions,
    webResults,
    quality.dedupFailed,
  );

  return finish(trace, {
    chunks: prepared.chunks,
    contradictions: quality.contradictions,
    gateScore: quality.gateScore,
    weakEvidence: quality.gateScore < RAG_QUALITY_GATE,
    webResults,
    queryClass: plan.queryClass,
    transforms,
  });
}

async function plainRetrieval(
  input: {
    workspaceId: string;
    userText: string;
  },
  plan: QueryPlan,
  transforms: QueryTransform[],
  trace: RagTraceRecorder,
): Promise<RagPipelineResult> {
  trace.step({
    id: "fallback",
    label: "Fallback retrieval",
    status: "active",
    summary: "Using the original message",
    lines: ["The quality judgement failed, so corrective scoring was skipped."],
  });

  const retrieved = capChunks(
    await retrieveWorkspaceContext(input.workspaceId, input.userText),
  );
  const enriched = await enrichChunks(input.workspaceId, retrieved);
  const prepared = await compressWithoutGate(enriched);

  trace.step({
    id: "fallback",
    label: "Fallback retrieval",
    status: "done",
    summary: `${prepared.chunks.length} chunks from the original message`,
    lines: retrieved.map(
      (chunk) =>
        `${chunk.sourceTitle} (${chunk.sourceType}, score ${chunk.score.toFixed(2)})`,
    ),
  });
  recordAuthority(trace, enriched);
  recordContext(
    trace,
    enriched,
    prepared.chunks,
    prepared.removed,
    [],
    null,
    prepared.dedupFailed,
  );

  return finish(trace, {
    chunks: prepared.chunks,
    contradictions: [],
    gateScore: 1,
    weakEvidence: false,
    webResults: null,
    queryClass: plan.queryClass,
    transforms,
  });
}

async function enrichChunks(
  workspaceId: string,
  chunks: RetrievedChunk[],
): Promise<EnrichedChunk[]> {
  if (chunks.length === 0) {
    return [];
  }

  try {
    const sources = await findSourcesByIds(
      workspaceId,
      chunks.map((chunk) => chunk.sourceId),
    );
    return enrichChunksWithSources(chunks, sources);
  } catch {
    logRagEvent("authority", { lookupFailed: true });
    return enrichChunksWithSources(chunks, []);
  }
}

async function compressWithoutGate(chunks: EnrichedChunk[]) {
  const embeddings = await embedChunksForDedup(chunks);
  const dedupFailed = chunks.length > 0 && embeddings.length !== chunks.length;
  const deduped = dedupFailed
    ? { unique: chunks, removedCount: 0 }
    : deduplicateChunks(chunks, embeddings, RAG_DEDUP_THRESHOLD);
  const compressed = compressChunks(
    deduped.unique,
    new Set<string>(),
    RAG_CONTEXT_CHAR_BUDGET,
  );
  const removed = chunks.filter(
    (chunk) => !deduped.unique.some((kept) => kept.chunkId === chunk.chunkId),
  );

  return {
    chunks: compressed,
    removed,
    dedupFailed,
  };
}

function compressForPrompt(quality: RetrievalQuality) {
  const pinned = new Set(
    quality.contradictions.flatMap((conflict) => conflict.chunkIds),
  );

  return {
    chunks: compressChunks(
      quality.uniqueChunks,
      pinned,
      RAG_CONTEXT_CHAR_BUDGET,
    ),
  };
}

function toWebSnippets(response: TavilySearchResponse): WebSnippet[] {
  return response.results.map((result) => ({
    title: result.title,
    url: result.url,
    content: result.content,
    score: typeof result.score === "number" ? result.score : RAG_NEUTRAL_FRESHNESS,
  }));
}

const QUERY_CLASS_LABELS: Record<QueryClass, string> = {
  simple_factual: "Simple factual",
  multi_hop: "Multi-hop",
  comparative: "Comparative",
  summarization: "Summarization",
  analytical: "Analytical",
  temporal: "Temporal",
  procedural: "Procedural",
  ambiguous: "Ambiguous",
  out_of_domain: "Out of domain",
  conversational: "Conversational",
};

function finish(
  trace: RagTraceRecorder,
  result: Omit<RagPipelineResult, "trace">,
): RagPipelineResult {
  return { ...result, trace: trace.snapshot() };
}

function recordPlanSteps(trace: RagTraceRecorder, plan: QueryPlan) {
  if (
    plan.transforms.includes("contextual_rewrite") &&
    plan.rewrittenQuery
  ) {
    trace.step({
      id: "rewrite",
      label: "Query rewrite",
      status: "done",
      summary: "Standalone search query",
      lines: [plan.rewrittenQuery],
    });
  }

  if (plan.transforms.includes("subquestion_decomposition")) {
    trace.step({
      id: "decompose",
      label: "Sub-question decomposition",
      status: "done",
      summary: `${plan.subqueries.length} sub-questions`,
      lines: plan.subqueries,
    });
  }

  if (plan.transforms.includes("multi_query")) {
    trace.step({
      id: "multi-query",
      label: "Multi-query",
      status: "done",
      summary: `${plan.subqueries.length} queries`,
      lines: plan.subqueries,
    });
  }

  if (plan.hydePassage) {
    trace.step({
      id: "hyde",
      label: "HyDE",
      status: "done",
      summary: "Hypothetical passage",
      lines: [plan.hydePassage],
    });
  }
}

function recordAuthority(trace: RagTraceRecorder, chunks: EnrichedChunk[]) {
  trace.step({
    id: "authority",
    label: "Source authority",
    status: "done",
    summary:
      chunks.length === 0
        ? "No chunks to weight"
        : `${chunks.length} chunks weighted`,
    lines: chunks.map(
      (chunk) =>
        `${chunk.sourceTitle}: ${authorityLabel(chunk.authority)} ${chunk.authorityWeight.toFixed(1)}`,
    ),
  });
}

function recordQuality(
  trace: RagTraceRecorder,
  quality: RetrievalQuality,
  summary: string,
  id = "quality",
) {
  const dimensions = quality.dimensions;
  trace.step({
    id,
    label: "Retrieval quality",
    status: "done",
    summary: `${summary}: gate ${formatScore(quality.gateScore)}`,
    lines: [
      `Relevance ${formatScore(dimensions.relevance)}`,
      `Coverage ${formatScore(dimensions.coverage)}`,
      `Freshness ${formatScore(dimensions.freshness)}`,
      `Authority ${formatScore(dimensions.authority)}`,
      `Duplication ${formatScore(dimensions.duplication)}`,
      `Contradictions ${quality.contradictions.length}`,
      `Gate ${formatScore(quality.gateScore)} (threshold ${RAG_QUALITY_GATE})`,
    ],
  });
}

function recordContext(
  trace: RagTraceRecorder,
  before: EnrichedChunk[],
  after: EnrichedChunk[],
  removed: EnrichedChunk[],
  contradictions: RetrievalQuality["contradictions"],
  webResults: TavilySearchResponse | null = null,
  dedupFailed = false,
) {
  const beforeCharacters = characterCount(before);
  const afterCharacters = characterCount(after);

  trace.step({
    id: "dedup",
    label: "Deduplication",
    status: "done",
    summary: dedupFailed
      ? "Skipped because chunk embeddings failed"
      : `${removed.length} removed, ${before.length - removed.length} retained`,
    lines: dedupFailed
      ? ["Every retrieved chunk was kept."]
      : [
          ...removed.map((chunk) => `Removed: ${chunk.sourceTitle}`),
          ...(before.length - removed.length === 0
            ? ["None retained."]
            : before
                .filter(
                  (chunk) =>
                    !removed.some((item) => item.chunkId === chunk.chunkId),
                )
                .map((chunk) => `Retained: ${chunk.sourceTitle}`)),
        ],
  });

  trace.step({
    id: "ranked",
    label: "Ranked",
    status: "done",
    summary: "Ordered by relevance × authority × freshness",
    lines: after.map((chunk) => {
      const rank = chunk.score * chunk.authorityWeight * chunk.freshness;
      return `${rank.toFixed(3)} ${chunk.sourceTitle} (${chunk.score.toFixed(2)} × ${chunk.authorityWeight.toFixed(1)} × ${chunk.freshness.toFixed(2)})`;
    }),
  });

  trace.step({
    id: "compression",
    label: "Context compression",
    status: "done",
    summary: `${beforeCharacters} → ${afterCharacters} characters`,
    lines: [
      `Before: ${before.length} chunks, ${beforeCharacters} characters.`,
      `After: ${after.length} chunks, ${afterCharacters} characters.`,
      `Budget: ${RAG_CONTEXT_CHAR_BUDGET} characters.`,
    ],
  });

  trace.step({
    id: "contradiction",
    label: "Contradiction detection",
    status: "done",
    summary:
      contradictions.length === 0
        ? "No conflicts"
        : `${contradictions.length} conflict${contradictions.length === 1 ? "" : "s"}`,
    lines:
      contradictions.length === 0
        ? ["Sources do not make incompatible claims."]
        : contradictions.map((conflict) => {
            const sources = [
              ...after
                .filter((chunk) => conflict.chunkIds.includes(chunk.chunkId))
                .map(
                  (chunk) =>
                    `${chunk.sourceTitle} (${authorityLabel(chunk.authority)}, ${chunk.indexedAt?.slice(0, 10) ?? "unknown time"})`,
                ),
              ...(webResults?.results ?? [])
                .filter((result) => conflict.webUrls.includes(result.url))
                .map((result) => `${result.title} (web source)`),
            ];
            return sources.length > 0
              ? `${conflict.summary} Sources: ${sources.join("; ")}.`
              : conflict.summary;
          }),
  });
}

function describeChunk(chunk: EnrichedChunk) {
  return `${chunk.sourceTitle} (${chunk.sourceType}, ${authorityLabel(chunk.authority)} ${chunk.authorityWeight.toFixed(1)}, score ${chunk.score.toFixed(2)})`;
}

function previewQuery(query: string) {
  const normalized = query.replace(/\s+/g, " ").trim();
  return normalized.length > 240
    ? `${normalized.slice(0, 240).trim()}…`
    : normalized;
}

function characterCount(chunks: EnrichedChunk[]) {
  return chunks.reduce((sum, chunk) => sum + chunk.text.length, 0);
}

function formatScore(value: number) {
  return (Math.round(value * 1000) / 1000).toFixed(3);
}
