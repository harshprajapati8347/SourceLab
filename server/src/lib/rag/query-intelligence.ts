/**
 * Query classification and the route table that chooses retrieval transforms.
 *
 * One structured model call labels the latest user message. Code, not the model,
 * decides which transforms run.
 */

import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";
import {
  RAG_INTELLIGENCE_MODEL,
  RAG_MAX_EXPANSIONS,
  RAG_MAX_SUBQUESTIONS,
} from "../ai-config.js";
import { logRagEvent } from "./rag-log.js";

export const QUERY_CLASSES = [
  "simple_factual",
  "multi_hop",
  "comparative",
  "summarization",
  "analytical",
  "temporal",
  "procedural",
  "ambiguous",
  "out_of_domain",
  "conversational",
] as const;

export type QueryClass = (typeof QUERY_CLASSES)[number];

export type QueryTransform =
  | "contextual_rewrite"
  | "hyde"
  | "subquestion_decomposition"
  | "multi_query"
  | "query_expansion"
  | "corrective_rewrite";

export type QueryPlan = {
  queryClass: QueryClass;
  transforms: QueryTransform[];
  retrievalQueries: string[];
  skipRetrieval: boolean;
  usedFallback: boolean;
  fallbackReason: "classification" | "hyde" | null;
  rewrittenQuery: string | null;
  hydePassage: string | null;
  subqueries: string[];
};

const classificationSchema = z.object({
  queryClass: z.enum(QUERY_CLASSES),
  dependsOnHistory: z.boolean(),
  rewrittenQuery: z.string(),
  subqueries: z.array(z.string()),
});

type Classification = z.infer<typeof classificationSchema>;

const correctiveSchema = z.object({
  rewrittenQuery: z.string(),
  expansions: z.array(z.string()),
});

/**
 * Classifies a user message and builds the first-pass retrieval queries.
 *
 * HyDE runs only for simple factual and ambiguous questions. A failed
 * classification or HyDE call falls open to embedding the original message.
 *
 * @param input - Latest user text plus conversation summary and recent turns
 * @returns Retrieval plan. `retrievalQueries` is empty when retrieval is skipped
 */
export async function planQuery(input: {
  userText: string;
  conversationSummary?: string | null;
  recentTurns?: string;
  onProgress?: (event: "classifying" | "hyde") => void;
}): Promise<QueryPlan> {
  try {
    input.onProgress?.("classifying");
    const classification = await classifyQuery(input);
    const routed = routeQuery(input.userText, classification);

    if (!routed.useHyde) {
      return {
        queryClass: classification.queryClass,
        transforms: routed.transforms,
        retrievalQueries: routed.queries,
        skipRetrieval: routed.skipRetrieval,
        usedFallback: false,
        fallbackReason: null,
        rewrittenQuery: routed.rewrittenQuery,
        hydePassage: null,
        subqueries: routed.subqueries,
      };
    }

    try {
      input.onProgress?.("hyde");
      const passage = await generateHypotheticalPassage(
        routed.queries[0] ?? input.userText,
      );
      return {
        queryClass: classification.queryClass,
        transforms: routed.transforms,
        retrievalQueries: uniqueQueries([...routed.queries, passage]),
        skipRetrieval: false,
        usedFallback: false,
        fallbackReason: null,
        rewrittenQuery: routed.rewrittenQuery,
        hydePassage: passage,
        subqueries: routed.subqueries,
      };
    } catch {
      logRagEvent("classification", { hydeFailed: true, fallback: true });
      return fallbackQueryPlan(input.userText, "hyde");
    }
  } catch {
    logRagEvent("classification", { fallback: true });
    return fallbackQueryPlan(input.userText, "classification");
  }
}

/**
 * Rewrites and expands a query after the retrieval-quality gate fails.
 *
 * @param userText - Original user message
 * @returns A rewritten query plus up to {@link RAG_MAX_EXPANSIONS} extra queries
 */
export async function planCorrectiveQueries(
  userText: string,
  onProgress?: () => void,
) {
  try {
    onProgress?.();
    const result = await generateText({
      model: openai(RAG_INTELLIGENCE_MODEL),
      output: Output.object({ schema: correctiveSchema }),
      system: [
        "You improve a search query that retrieved weak workspace evidence.",
        "Rewrite it into a standalone search query and add a few alternative phrasings.",
        "The queries may look for details that are missing from what was already retrieved.",
        "Do not tell the search to infer, guess, assume, or fill in missing facts.",
        "Do not answer the question.",
      ].join("\n"),
      prompt: userText,
    });

    if (!result.output) {
      throw new Error("Corrective query planning returned no output");
    }

    const rewrittenQuery =
      sanitizeRetrievalQuery(
        result.output.rewrittenQuery.trim() || userText.trim(),
      ) || sanitizeRetrievalQuery(userText.trim());
    const expansions = uniqueQueries(
      result.output.expansions.map((query) => sanitizeRetrievalQuery(query)),
    ).slice(0, RAG_MAX_EXPANSIONS);

    return {
      rewrittenQuery,
      retrievalQueries: uniqueQueries([rewrittenQuery, ...expansions]),
      transforms: [
        "corrective_rewrite",
        ...(expansions.length > 0 ? (["query_expansion"] as const) : []),
      ] satisfies QueryTransform[],
    };
  } catch {
    logRagEvent("corrective", { planFailed: true });
    const rewrittenQuery = userText.trim();
    return {
      rewrittenQuery,
      retrievalQueries: rewrittenQuery ? [rewrittenQuery] : [],
      transforms: ["corrective_rewrite"] as QueryTransform[],
    };
  }
}

/**
 * Maps a classification onto transforms and retrieval strings.
 *
 * @param userText - Original user message
 * @param classification - Structured classifier output
 * @returns Route decision consumed by {@link planQuery}
 */
export function routeQuery(userText: string, classification: Classification) {
  const rewritten =
    sanitizeRetrievalQuery(
      classification.rewrittenQuery.trim() || userText.trim(),
    ) || userText.trim();
  const subqueries = uniqueQueries(
    classification.subqueries.map((query) => sanitizeRetrievalQuery(query)),
  ).slice(0, RAG_MAX_SUBQUESTIONS);
  const queryClass = classification.queryClass;

  const decision = (partial: {
    transforms: QueryTransform[];
    queries: string[];
    skipRetrieval: boolean;
    useHyde: boolean;
  }) => ({
    rewrittenQuery: rewritten,
    subqueries,
    ...partial,
  });

  if (queryClass === "conversational" || queryClass === "out_of_domain") {
    return decision({
      transforms: [],
      queries: [],
      skipRetrieval: true,
      useHyde: false,
    });
  }

  if (queryClass === "multi_hop" || queryClass === "analytical") {
    return decision({
      transforms: ["subquestion_decomposition"],
      queries: subqueries.length > 0 ? subqueries : [rewritten],
      skipRetrieval: false,
      useHyde: false,
    });
  }

  if (queryClass === "comparative") {
    return decision({
      transforms: ["multi_query"],
      queries: subqueries.length > 0 ? subqueries : [rewritten],
      skipRetrieval: false,
      useHyde: false,
    });
  }

  if (
    queryClass === "summarization" ||
    queryClass === "temporal" ||
    queryClass === "procedural"
  ) {
    return decision({
      transforms: ["contextual_rewrite"],
      queries: [rewritten],
      skipRetrieval: false,
      useHyde: false,
    });
  }

  if (queryClass === "ambiguous") {
    return decision({
      transforms: ["contextual_rewrite", "hyde"],
      queries: [rewritten],
      skipRetrieval: false,
      useHyde: true,
    });
  }

  const searchable =
    sanitizeRetrievalQuery(userText.trim()) || userText.trim();
  const transforms: QueryTransform[] = classification.dependsOnHistory
    ? ["contextual_rewrite", "hyde"]
    : ["hyde"];

  return decision({
    transforms,
    queries: [classification.dependsOnHistory ? rewritten : searchable],
    skipRetrieval: false,
    useHyde: true,
  });
}

/**
 * Builds the plan used when classification does not return a usable result.
 *
 * @param userText - Original user message
 * @returns A single-query plan with no transforms
 */
export function fallbackQueryPlan(
  userText: string,
  fallbackReason: "classification" | "hyde" = "classification",
): QueryPlan {
  const trimmed = userText.trim();
  return {
    queryClass: "simple_factual",
    transforms: [],
    retrievalQueries: trimmed ? [trimmed] : [],
    skipRetrieval: false,
    usedFallback: true,
    fallbackReason,
    rewrittenQuery: null,
    hydePassage: null,
    subqueries: [],
  };
}

async function classifyQuery(input: {
  userText: string;
  conversationSummary?: string | null;
  recentTurns?: string;
}) {
  const result = await generateText({
    model: openai(RAG_INTELLIGENCE_MODEL),
    output: Output.object({ schema: classificationSchema }),
    system: [
      "You classify the latest user message for a workspace document assistant.",
      "Choose one queryClass:",
      "- simple_factual: one fact from the sources",
      "- multi_hop: needs more than one fact or source combined",
      "- comparative: compares two or more things",
      "- summarization: asks for a summary or overview",
      "- analytical: asks for reasoning, causes, or implications",
      "- temporal: depends on dates, versions, or recency",
      "- procedural: asks how to do something",
      "- ambiguous: the question cannot be searched as written",
      "- out_of_domain: not about the user's workspace materials",
      "- conversational: greeting, thanks, or small talk",
      "Set dependsOnHistory when the message relies on earlier turns.",
      "rewrittenQuery must be a standalone search query.",
      "Search queries may ask for details that could be missing. They must not say to infer, guess, or fill in those details.",
      "subqueries are required for multi_hop, analytical, and comparative questions, and empty otherwise.",
      "For comparative questions, use one subquery per side.",
      "Do not answer the question.",
    ].join("\n"),
    prompt: [
      input.conversationSummary?.trim()
        ? `Conversation summary:\n${input.conversationSummary.trim()}`
        : "",
      input.recentTurns?.trim()
        ? `Recent turns:\n${input.recentTurns.trim()}`
        : "",
      `Latest user message:\n${input.userText}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  });

  if (!result.output) {
    throw new Error("Query classification returned no output");
  }

  return result.output;
}

async function generateHypotheticalPassage(query: string) {
  const result = await generateText({
    model: openai(RAG_INTELLIGENCE_MODEL),
    system: [
      "Write a short hypothetical source passage that would answer the question.",
      "Write it as document text, in about 120 to 180 words.",
      "Do not mention that the passage is hypothetical, and do not add citations.",
    ].join("\n"),
    prompt: query,
  });

  const passage = result.text.trim();
  if (!passage) {
    throw new Error("HyDE passage was empty");
  }

  return passage;
}

/**
 * Removes instructions that tell retrieval to invent missing facts.
 *
 * The query can still search for a field that might be absent. It cannot
 * ask the search to infer that field.
 *
 * @param query - Rewritten query or expansion
 * @returns The query with inference instructions removed
 */
export function sanitizeRetrievalQuery(query: string) {
  const cleaned = query
    .replace(
      /\s*(?:,|while|by|and|when)?\s*\b(?:infer(?:ring)?|guess(?:ing)?|assum(?:e|ing)|fabricat(?:e|ing)|invent(?:ing)?|fill(?:ing)? in)\b(?:\s+\w+){0,6}\s*missing(?:\s+\w+){0,4}/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .trim();

  return cleaned;
}

function uniqueQueries(queries: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const query of queries) {
    const trimmed = query.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(trimmed);
  }

  return unique;
}
