/**
 * Source authority weights and freshness for retrieved chunks.
 *
 * Official, internal, and approved-wiki weights apply only when a source
 * already stores `metadata.authority`. Otherwise the weight comes from source type.
 */

import {
  RAG_FRESHNESS_HALF_LIFE_DAYS,
  RAG_NEUTRAL_FRESHNESS,
} from "../ai-config.js";
import type { RetrievedChunk } from "./retrieve.js";

export const AUTHORITY_WEIGHTS = {
  official_policy: 1,
  internal_document: 0.9,
  approved_wiki: 0.8,
  user_uploaded: 0.7,
  web: 0.5,
  unknown: 0.2,
} as const;

export type AuthorityClass = keyof typeof AUTHORITY_WEIGHTS;

const AUTHORITY_LABELS: Record<AuthorityClass, string> = {
  official_policy: "official policy",
  internal_document: "internal document",
  approved_wiki: "approved wiki",
  user_uploaded: "user uploaded file",
  web: "web source",
  unknown: "unknown",
};

/** A retrieved chunk plus the authority and freshness used to rank it. */
export type EnrichedChunk = RetrievedChunk & {
  authority: AuthorityClass;
  authorityWeight: number;
  indexedAt?: string;
  freshness: number;
};

export type AuthoritySource = {
  id: string;
  type: string;
  metadata: unknown;
  createdAt: Date;
};

/**
 * Human-readable authority name for the system prompt.
 *
 * @param authority - Authority class stored on a chunk
 * @returns Label such as "user uploaded file"
 */
export function authorityLabel(authority: AuthorityClass) {
  return AUTHORITY_LABELS[authority];
}

/**
 * Resolves an authority class from an explicit metadata override or the source type.
 *
 * @param sourceType - Pinecone or Prisma source type
 * @param metadata - Source metadata JSON, which may contain `authority`
 * @returns Authority class and its weight
 */
export function resolveAuthority(sourceType: string, metadata: unknown) {
  const override = readAuthorityOverride(metadata);
  const authority = override ?? defaultAuthority(sourceType);
  return {
    authority,
    authorityWeight: AUTHORITY_WEIGHTS[authority],
  };
}

/**
 * Picks the timestamp used for freshness: `metadata.indexedAt`, then `createdAt`.
 *
 * @param metadata - Source metadata JSON
 * @param createdAt - Source row creation time
 * @returns ISO timestamp, or undefined when neither value is usable
 */
export function resolveIndexedAt(metadata: unknown, createdAt?: Date) {
  const indexedAt = readString(metadata, "indexedAt");
  if (indexedAt && !Number.isNaN(Date.parse(indexedAt))) {
    return indexedAt;
  }

  if (createdAt && !Number.isNaN(createdAt.getTime())) {
    return createdAt.toISOString();
  }

  return undefined;
}

/**
 * Maps an indexed time onto 0–1. Newer sources score higher.
 *
 * A missing or unparseable time returns {@link RAG_NEUTRAL_FRESHNESS}.
 * The score is 1 for a source indexed now and 0.5 after
 * {@link RAG_FRESHNESS_HALF_LIFE_DAYS}.
 *
 * @param indexedAt - ISO timestamp from {@link resolveIndexedAt}
 * @param now - Clock injection for tests
 * @returns Freshness from 0 to 1
 */
export function freshnessScore(indexedAt?: string, now = Date.now()) {
  if (!indexedAt) {
    return RAG_NEUTRAL_FRESHNESS;
  }

  const time = Date.parse(indexedAt);
  if (Number.isNaN(time)) {
    return RAG_NEUTRAL_FRESHNESS;
  }

  const ageDays = Math.max(0, (now - time) / 86_400_000);
  return Math.exp((-Math.LN2 * ageDays) / RAG_FRESHNESS_HALF_LIFE_DAYS);
}

/**
 * Attaches authority and freshness to chunks using the matching source rows.
 *
 * A chunk whose source row is missing keeps its Pinecone source type and a
 * neutral freshness score.
 *
 * @param chunks - Retrieved workspace chunks
 * @param sources - Source rows for those chunk source ids
 * @returns Enriched copies of `chunks` in the same order
 */
export function enrichChunksWithSources(
  chunks: RetrievedChunk[],
  sources: AuthoritySource[],
) {
  const byId = new Map(sources.map((source) => [source.id, source]));

  return chunks.map((chunk) => {
    const source = byId.get(chunk.sourceId);
    const metadata = source?.metadata;
    const sourceType = source?.type ?? chunk.sourceType;
    const { authority, authorityWeight } = resolveAuthority(sourceType, metadata);
    const indexedAt = resolveIndexedAt(metadata, source?.createdAt);

    return {
      ...chunk,
      authority,
      authorityWeight,
      ...(indexedAt ? { indexedAt } : {}),
      freshness: freshnessScore(indexedAt),
    };
  });
}

function defaultAuthority(sourceType: string): AuthorityClass {
  switch (sourceType) {
    case "PDF":
    case "TEXT":
    case "MARKDOWN":
      return "user_uploaded";
    case "WEBSITE":
    case "YOUTUBE":
      return "web";
    default:
      return "unknown";
  }
}

function readAuthorityOverride(metadata: unknown): AuthorityClass | undefined {
  const value = readString(metadata, "authority");
  if (value && value in AUTHORITY_WEIGHTS) {
    return value as AuthorityClass;
  }

  return undefined;
}

function readString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined;
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}
