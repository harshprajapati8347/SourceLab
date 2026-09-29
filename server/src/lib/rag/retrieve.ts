/**
 * RAG retrieval and chat system prompt construction.
 *
 * Embeds the user query, searches Pinecone, filters by score,
 * and builds the system prompt with retrieved context, memories, and summary.
 */

import {
  RAG_MERGED_CHUNK_CAP,
  RAG_MIN_SCORE,
  RAG_TOP_K,
} from "../ai-config.js";
import { embedTexts } from "../openai.js";
import { queryWorkspaceVectors } from "../pinecone.js";
import { authorityLabel, type AuthorityClass } from "./authority.js";
import type { Contradiction } from "./retrieval-quality.js";
import {
  formatTavilyResultsForPrompt,
  type TavilySearchResponse,
} from "../tavily.js";

/** A source chunk returned from Pinecone with similarity score. */
export type RetrievedChunk = {
  sourceId: string;
  sourceTitle: string;
  sourceType: string;
  chunkId: string;
  chunkIndex: number;
  page?: number;
  text: string;
  score: number;
  authority?: AuthorityClass;
  authorityWeight?: number;
  indexedAt?: string;
  freshness?: number;
};

export type RetrievalOptions = {
  minScore?: number;
  topK?: number;
};

/**
 * Retrieves the most relevant source chunks for a user query via vector search.
 *
 * @param workspaceId - Workspace namespace in Pinecone
 * @param query - User message text to embed and search with
 * @param options - Optional similarity floor and result count
 * @returns Chunks scoring above the minimum score, up to the requested top-K
 */
export async function retrieveWorkspaceContext(
  workspaceId: string,
  query: string,
  options?: RetrievalOptions,
): Promise<RetrievedChunk[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const [embedding] = await embedTexts([trimmed]);
  if (!embedding) {
    return [];
  }

  const matches = await queryWorkspaceVectors(
    workspaceId,
    embedding,
    options?.topK ?? RAG_TOP_K,
  );

  return chunksFromMatches(matches, options?.minScore ?? RAG_MIN_SCORE);
}

/**
 * Embeds every query in one batch, searches in parallel, and merges by chunk id.
 *
 * The higher similarity score is kept when the same chunk matches more than one query.
 *
 * @param workspaceId - Workspace namespace in Pinecone
 * @param queries - Retrieval strings, including a hypothetical passage when HyDE is used
 * @param options - Similarity floor and per-query top-K
 * @returns Merged chunks ordered by score, capped at {@link RAG_MERGED_CHUNK_CAP}
 */
export async function retrieveMergedWorkspaceContext(
  workspaceId: string,
  queries: string[],
  options?: RetrievalOptions,
): Promise<RetrievedChunk[]> {
  const unique = uniqueQueries(queries);
  if (unique.length === 0) {
    return [];
  }

  if (unique.length === 1) {
    const chunks = await retrieveWorkspaceContext(
      workspaceId,
      unique[0],
      options,
    );
    return capChunks(chunks);
  }

  const embeddings = await embedTexts(unique);
  const minScore = options?.minScore ?? RAG_MIN_SCORE;
  const topK = options?.topK ?? RAG_TOP_K;
  const groups = await Promise.all(
    embeddings.map(async (embedding) => {
      const matches = await queryWorkspaceVectors(workspaceId, embedding, topK);
      return chunksFromMatches(matches, minScore);
    }),
  );

  return capChunks(mergeRetrievedChunks(groups));
}

/**
 * Merges retrieval lists by chunk id, keeping the higher score.
 *
 * @param groups - Chunk lists from separate queries
 * @returns Unique chunks ordered by score descending
 */
export function mergeRetrievedChunks(groups: RetrievedChunk[][]) {
  const byId = new Map<string, RetrievedChunk>();

  for (const group of groups) {
    for (const chunk of group) {
      const existing = byId.get(chunk.chunkId);
      if (!existing || chunk.score > existing.score) {
        byId.set(chunk.chunkId, chunk);
      }
    }
  }

  return [...byId.values()].sort((left, right) => right.score - left.score);
}

/**
 * Keeps the highest-scoring chunks up to the merged-result cap.
 *
 * @param chunks - Scored chunks
 * @returns At most {@link RAG_MERGED_CHUNK_CAP} chunks
 */
export function capChunks(chunks: RetrievedChunk[]) {
  return [...chunks]
    .sort((left, right) => right.score - left.score)
    .slice(0, RAG_MERGED_CHUNK_CAP);
}

export type UserMemoryContext = string;

/**
 * Builds the full chat system prompt with RAG context, user memories, summary, and web search hints.
 *
 * @param input - Prompt building blocks from chat service
 * @returns Multi-section system prompt string for `streamText`
 */
export function buildChatSystemPrompt(input: {
  chunks: RetrievedChunk[];
  conversationSummary?: string | null;
  userMemories?: UserMemoryContext[];
  webSearchEnabled?: boolean;
  webResults?: TavilySearchResponse | null;
  contradictions?: Contradiction[];
  weakEvidence?: boolean;
}) {
  const sections: string[] = [
    "You are SourceLab, an assistant that helps users learn from their workspace sources.",
  ];

  if (input.webSearchEnabled) {
    sections.push(
      "You have access to a web_search tool for up-to-date information outside the workspace.",
      "Use it when the user asks about recent events or topics not covered by their sources.",
      "Cite web results inline using [W1], [W2], etc. matching the web result blocks.",
    );
  }

  if (input.userMemories?.length) {
    const memoryBlock = input.userMemories
      .map((memory) => `- ${memory}`)
      .join("\n");

    sections.push(
      "Known facts about this user (use when relevant):",
      memoryBlock,
    );
  }

  const summary = input.conversationSummary?.trim();
  if (summary) {
    sections.push("Earlier conversation summary:", summary);
  }

  if (input.weakEvidence) {
    sections.push(
      "Retrieved evidence for this question is limited.",
      "Say what the sources support, say what is uncertain, and do not invent citations.",
    );
  }

  const contradictions = formatContradictions(
    input.contradictions ?? [],
    input.chunks,
    input.webResults,
  );
  if (contradictions) {
    sections.push(contradictions);
  }

  if (input.chunks.length === 0) {
    const prefetchedWeb = (input.webResults?.results.length ?? 0) > 0;
    sections.push(
      "This workspace has no indexed source content yet, or nothing relevant was retrieved.",
      prefetchedWeb
        ? "Use the web results below when they apply. Write each factual claim as its own sentence, with its citation marker in that sentence. If a requested detail is not stated, say that it is not in the sources. Do not infer or fill in missing details."
        : input.webSearchEnabled
          ? "Use web search when needed, or answer from general knowledge."
          : "Answer helpfully from general knowledge and suggest adding or processing sources when appropriate.",
      "Do not invent citations.",
    );
    appendWebResults(sections, input.webResults);
    return sections.join("\n");
  }

  const context = input.chunks
    .map((chunk, index) => {
      return `${formatChunkLabel(chunk, index + 1)}\n${chunk.text}`;
    })
    .join("\n\n");

  sections.push(
    "Use ONLY the retrieved context below when making factual claims about their materials.",
    "If the context is insufficient, say so clearly.",
    "Cite sources inline using [1], [2], etc. matching the numbered context blocks.",
    "Write each factual claim as its own sentence, with its citation marker in that sentence.",
    "If a requested detail is not stated in the retrieved context, say that it is not in the sources in its own sentence.",
    "Do not infer, guess, or fill in missing details.",
    "Keep answers concise, accurate, and educational.",
    "",
    "Retrieved context:",
    context,
  );

  appendWebResults(sections, input.webResults);
  return sections.join("\n");
}

function appendWebResults(
  sections: string[],
  webResults: TavilySearchResponse | null | undefined,
) {
  if (!webResults || webResults.results.length === 0) {
    return;
  }

  sections.push(
    "Web results retrieved before this reply. Cite them as [W1], [W2], and so on.",
    formatTavilyResultsForPrompt(webResults),
  );
}

function formatChunkLabel(chunk: RetrievedChunk, number: number) {
  const details = [chunk.sourceType];

  if (chunk.authority) {
    details.push(authorityLabel(chunk.authority));
  }

  if (typeof chunk.authorityWeight === "number") {
    details.push(`authority ${chunk.authorityWeight.toFixed(1)}`);
  }

  if (chunk.indexedAt) {
    details.push(`indexed ${chunk.indexedAt.slice(0, 10)}`);
  }

  if (chunk.page) {
    details.push(`page ${chunk.page}`);
  }

  return `[${number}] ${chunk.sourceTitle} (${details.join(", ")})`;
}

function formatContradictions(
  contradictions: Contradiction[],
  chunks: RetrievedChunk[],
  webResults: TavilySearchResponse | null | undefined,
) {
  if (contradictions.length === 0) {
    return "";
  }

  const lines = [
    "Conflicts between sources. Do not merge these into a single fact.",
    "Present each conflicting claim. Prefer the newer, higher-authority source when you explain the conflict.",
  ];

  for (const conflict of contradictions) {
    const sources = chunks
      .filter((chunk) => conflict.chunkIds.includes(chunk.chunkId))
      .map((chunk) => describeChunkSource(chunk));
    const web = (webResults?.results ?? [])
      .filter((result) => conflict.webUrls.includes(result.url))
      .map((result) => `${result.title} (web source, authority 0.5)`);

    const cited = [...sources, ...web];
    lines.push(
      cited.length > 0
        ? `- ${conflict.summary} Sources: ${cited.join("; ")}.`
        : `- ${conflict.summary}`,
    );
  }

  return lines.join("\n");
}

function describeChunkSource(chunk: RetrievedChunk) {
  const authority = chunk.authority
    ? authorityLabel(chunk.authority)
    : "unknown";
  const weight =
    typeof chunk.authorityWeight === "number"
      ? chunk.authorityWeight.toFixed(1)
      : "0.2";
  const indexed = chunk.indexedAt ? chunk.indexedAt.slice(0, 10) : "unknown";
  return `${chunk.sourceTitle} (${authority}, authority ${weight}, indexed ${indexed})`;
}

function chunksFromMatches(
  matches: Awaited<ReturnType<typeof queryWorkspaceVectors>>,
  minScore: number,
) {
  const chunks: RetrievedChunk[] = [];

  for (const match of matches) {
    const score = match.score ?? 0;
    if (score < minScore) {
      continue;
    }

    const metadata = match.metadata as Record<string, unknown> | undefined;
    if (
      !metadata ||
      typeof metadata.sourceId !== "string" ||
      typeof metadata.sourceTitle !== "string" ||
      typeof metadata.sourceType !== "string" ||
      typeof metadata.chunkId !== "string" ||
      typeof metadata.text !== "string"
    ) {
      continue;
    }

    chunks.push({
      sourceId: metadata.sourceId,
      sourceTitle: metadata.sourceTitle,
      sourceType: metadata.sourceType,
      chunkId: metadata.chunkId,
      chunkIndex: Number(metadata.chunkIndex ?? 0),
      ...(typeof metadata.page === "number" ? { page: metadata.page } : {}),
      text: metadata.text,
      score,
    });
  }

  return chunks;
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
