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
  RAG_TOPIC_COVERAGE_FLOOR,
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
  mergeOverviewChunks,
  mergeRetrievedChunks,
  retrieveMergedWorkspaceContext,
  retrieveWorkspaceContext,
  selectOverviewChunks,
  type RetrievedChunk,
} from "../lib/rag/retrieve.js";
import {
  describeNotebookGap,
  type NotebookPassage,
  suggestFollowUpQuestions,
} from "../lib/rag/suggested-questions.js";
import {
  acceptsWebResearch,
  buildUncoveredTopicReply,
  focusFromTitles,
  pendingWebResearchTopic,
  questionTermsMissing,
  sourcesMissTopic,
  topicFromQuestion,
} from "../lib/rag/topic-gap.js";
import {
  evaluateRetrievalQuality,
  type Contradiction,
  type RetrievalQuality,
  type WebSnippet,
} from "../lib/rag/retrieval-quality.js";
import {
  findReadySourcesWithChunks,
  findSourcesByIds,
} from "../repositories/source.repository.js";
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
  /** Set when the reply is written without the chat model. */
  directReply: string | null;
  /** Set when the user accepted an offer to research this topic on the web. */
  researchTopic: string | null;
  /** Notebook passages used to describe a gap. Empty on a normal answer. */
  sourceSamples: NotebookPassage[];
  /**
   * Follow-up questions already chosen for a gap reply.
   * Null means the chat service should suggest them after the answer is written.
   */
  suggestions: string[] | null;
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

  const acceptedTopic = pendingWebResearchTopic(input.recentTurns ?? "");
  if (acceptedTopic && acceptsWebResearch(input.userText)) {
    return answerAcceptedResearch(input, acceptedTopic, trace);
  }

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
        "Conversational messages are not searched.",
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

  if (plan.queryClass === "summarization") {
    const overview = await finishOverview(
      input.workspaceId,
      plan,
      retrieved,
      trace,
    );
    if (overview) {
      return overview;
    }
  }

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
  const initialCoverage = quality.dimensions.coverage;
  const initialMiss = topicMissed(input.userText, quality);
  recordQuality(trace, quality, "Initial retrieval");

  const needsAnotherPass =
    quality.gateScore < RAG_QUALITY_GATE || initialMiss;

  if (needsAnotherPass) {
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
      initialGateScore < RAG_QUALITY_GATE
        ? `Triggered because the gate was ${formatScore(initialGateScore)}, below ${RAG_QUALITY_GATE}.`
        : `Triggered because the sources do not cover the question (coverage ${formatScore(initialCoverage)}).`,
      `Rewrite: ${corrective.rewrittenQuery}`,
      ...corrective.retrievalQueries.map(previewQuery),
      `Gate after workspace retry: ${formatScore(quality.gateScore)}.`,
      `Coverage after workspace retry: ${formatScore(quality.dimensions.coverage)}.`,
    ];

    if (topicMissed(input.userText, quality)) {
      trace.step({
        id: "crag",
        label: "CRAG",
        status: "done",
        summary: "Sources don't cover this question",
        lines: [
          ...cragLines,
          "Web search waits until the user accepts it.",
        ],
      });
      recordQuality(
        trace,
        quality,
        "After corrective retrieval",
        "quality-final",
      );
      return finishUncovered(
        input,
        plan,
        transforms,
        trace,
        quality.uniqueChunks,
        quality.dimensions.coverage,
      );
    }

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

/**
 * Builds an overview from one opening passage per ready source, plus semantic hits.
 *
 * Returns null when no ready source has chunk text, so the caller can use the normal gate.
 */
async function finishOverview(
  workspaceId: string,
  plan: QueryPlan,
  retrieved: RetrievedChunk[],
  trace: RagTraceRecorder,
): Promise<RagPipelineResult | null> {
  const sources = await findReadySourcesWithChunks(workspaceId);
  const overview = selectOverviewChunks(sources, RAG_CONTEXT_CHAR_BUDGET);
  if (overview.chunks.length === 0) {
    return null;
  }

  const merged = mergeOverviewChunks(overview.chunks, retrieved);
  const enriched = await enrichChunks(workspaceId, merged);
  recordAuthority(trace, enriched);
  trace.step({
    id: "overview",
    label: "Overview",
    status: "done",
    summary: `${overview.pinnedIds.length} ${overview.pinnedIds.length === 1 ? "source" : "sources"} sampled`,
    lines: overview.chunks.map((chunk) =>
      chunk.page
        ? `${chunk.sourceTitle}, page ${chunk.page}`
        : chunk.sourceTitle,
    ),
  });
  trace.step({
    id: "crag",
    label: "CRAG",
    status: "done",
    summary: "Not used for an overview",
    lines: [
      "Overview questions use a passage from each ready source.",
      "A low similarity score does not start another search.",
    ],
  });

  const compressed = compressChunks(
    enriched,
    new Set(overview.pinnedIds),
    RAG_CONTEXT_CHAR_BUDGET,
  );
  const removed = enriched.filter(
    (chunk) => !compressed.some((kept) => kept.chunkId === chunk.chunkId),
  );
  recordContext(trace, enriched, compressed, removed, []);

  return finish(trace, {
    chunks: compressed,
    contradictions: [],
    gateScore: 1,
    weakEvidence: false,
    webResults: null,
    queryClass: plan.queryClass,
    transforms: plan.transforms,
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
  result: Omit<
    RagPipelineResult,
    "trace" | "directReply" | "researchTopic" | "sourceSamples" | "suggestions"
  > &
    Partial<
      Pick<
        RagPipelineResult,
        "directReply" | "researchTopic" | "sourceSamples" | "suggestions"
      >
    >,
): RagPipelineResult {
  return {
    directReply: null,
    researchTopic: null,
    sourceSamples: [],
    suggestions: null,
    ...result,
    trace: trace.snapshot(),
  };
}

function topicMissed(
  question: string,
  quality: Pick<RetrievalQuality, "dimensions" | "uniqueChunks">,
) {
  return (
    sourcesMissTopic(quality.dimensions.coverage) ||
    questionTermsMissing(
      question,
      quality.uniqueChunks.map((chunk) => chunk.text),
    )
  );
}

async function loadNotebookSamples(
  workspaceId: string,
  chunks: EnrichedChunk[],
): Promise<NotebookPassage[]> {
  if (chunks.length > 0) {
    return chunks.slice(0, 6).map((chunk) => ({
      title: chunk.sourceTitle,
      text: chunk.text.slice(0, 700),
    }));
  }

  try {
    const sources = await findReadySourcesWithChunks(workspaceId);
    const overview = selectOverviewChunks(sources, 4000);
    return overview.chunks.slice(0, 6).map((chunk) => ({
      title: chunk.sourceTitle,
      text: chunk.text.slice(0, 700),
    }));
  } catch {
    logRagEvent("suggestions", { samplesFailed: true });
    return [];
  }
}

async function finishUncovered(
  input: {
    workspaceId: string;
    userText: string;
    webSearchEnabled: boolean;
  },
  plan: QueryPlan,
  transforms: QueryTransform[],
  trace: RagTraceRecorder,
  chunks: EnrichedChunk[],
  coverage: number,
): Promise<RagPipelineResult> {
  const samples = await loadNotebookSamples(input.workspaceId, chunks);
  const topic = topicFromQuestion(input.userText);
  const described = await describeNotebookGap({ topic, passages: samples });
  const focus =
    described.focus ?? focusFromTitles(samples.map((sample) => sample.title));

  trace.step({
    id: "source-coverage",
    label: "Source coverage",
    status: "done",
    summary: `Not covered: ${topic}`,
    lines: [
      `Coverage ${formatScore(coverage)} is below ${RAG_TOPIC_COVERAGE_FLOOR}, or the passages do not mention the topic.`,
      focus ? `Notebook focus: ${focus}` : "No ready source text to describe.",
      input.webSearchEnabled
        ? "Offered web research."
        : "Web search is off, so the reply asks the user to turn it on.",
    ],
  });

  return finish(trace, {
    chunks: [],
    contradictions: [],
    gateScore: coverage,
    weakEvidence: true,
    webResults: null,
    queryClass: plan.queryClass,
    transforms,
    directReply: buildUncoveredTopicReply({
      topic,
      focus,
      webSearchEnabled: input.webSearchEnabled,
    }),
    suggestions: described.questions,
    sourceSamples: samples,
  });
}

async function answerAcceptedResearch(
  input: {
    workspaceId: string;
    webSearchEnabled: boolean;
  },
  topic: string,
  trace: RagTraceRecorder,
): Promise<RagPipelineResult> {
  trace.step({
    id: "classified",
    label: "Classified",
    status: "done",
    summary: "Web research accepted",
    lines: [`Topic: ${topic}`],
  });

  if (!input.webSearchEnabled) {
    const samples = await loadNotebookSamples(input.workspaceId, []);
    const questions = await suggestFollowUpQuestions({
      question: topic,
      answer: `The notebook does not cover ${topic}.`,
      passages: samples,
      preferNotebook: true,
    });
    trace.step({
      id: "source-coverage",
      label: "Source coverage",
      status: "done",
      summary: "Web search is off",
      lines: ["The user agreed to research, and the web search toggle is off."],
    });
    return finish(trace, {
      chunks: [],
      contradictions: [],
      gateScore: 0,
      weakEvidence: true,
      webResults: null,
      queryClass: "simple_factual",
      transforms: [],
      directReply: `Web search is off. Turn it on and ask again, and I'll research ${topic}.`,
      suggestions: questions,
      sourceSamples: samples,
    });
  }

  trace.step({
    id: "crag",
    label: "CRAG",
    status: "active",
    summary: "Searching the web",
    lines: [topic],
  });

  try {
    const webResults = await searchWeb(topic);
    trace.step({
      id: "crag",
      label: "CRAG",
      status: "done",
      summary: `${webResults.results.length} web ${webResults.results.length === 1 ? "result" : "results"}`,
      lines: webResults.results.map((item) => item.title),
    });

    if (webResults.results.length === 0) {
      return finish(trace, {
        chunks: [],
        contradictions: [],
        gateScore: 0,
        weakEvidence: true,
        webResults: null,
        queryClass: "simple_factual",
        transforms: [],
        directReply: `I couldn't find web results on ${topic}. Try again in a moment.`,
      });
    }

    return finish(trace, {
      chunks: [],
      contradictions: [],
      gateScore: 1,
      weakEvidence: false,
      webResults,
      queryClass: "simple_factual",
      transforms: [],
      researchTopic: topic,
    });
  } catch {
    logRagEvent("web-research", { failed: true });
    trace.step({
      id: "crag",
      label: "CRAG",
      status: "done",
      summary: "Web search failed",
      lines: ["The search did not return results."],
    });
    return finish(trace, {
      chunks: [],
      contradictions: [],
      gateScore: 0,
      weakEvidence: true,
      webResults: null,
      queryClass: "simple_factual",
      transforms: [],
      directReply: `I couldn't complete web research on ${topic}. Try again in a moment.`,
    });
  }
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
