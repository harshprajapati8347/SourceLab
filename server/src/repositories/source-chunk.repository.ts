import type { Prisma } from "../generated/prisma/client.js";
import prisma from "../lib/db.js";

export const sourceChunkSelect = {
  id: true,
  sourceId: true,
  index: true,
  content: true,
  tokenCount: true,
  metadata: true,
  createdAt: true,
} as const;

export type SourceChunkRecord = Prisma.SourceChunkGetPayload<{
  select: typeof sourceChunkSelect;
}>;

export type CreateSourceChunkData = {
  sourceId: string;
  index: number;
  content: string;
  tokenCount?: number | null;
  metadata?: Prisma.InputJsonValue;
};

export function deleteChunksBySourceId(sourceId: string) {
  return prisma.sourceChunk.deleteMany({
    where: { sourceId },
  });
}

export function createSourceChunks(chunks: CreateSourceChunkData[]) {
  if (chunks.length === 0) {
    return Promise.resolve([]);
  }

  return prisma.$transaction(
    chunks.map((chunk) =>
      prisma.sourceChunk.create({
        data: {
          sourceId: chunk.sourceId,
          index: chunk.index,
          content: chunk.content,
          tokenCount: chunk.tokenCount ?? null,
          metadata: chunk.metadata,
        },
        select: sourceChunkSelect,
      }),
    ),
  );
}

export function findChunksBySourceId(sourceId: string) {
  return prisma.sourceChunk.findMany({
    where: { sourceId },
    select: sourceChunkSelect,
    orderBy: { index: "asc" },
  });
}

/**
 * Loads ready chunks in one workspace whose text contains a missing term.
 *
 * @param workspaceId - Workspace that owns the sources
 * @param terms - Words or numbers absent from the vector hits
 * @param limit - Maximum rows to return
 * @returns Matching chunks with their source title and type
 */
export function findChunksByContentTerms(
  workspaceId: string,
  terms: string[],
  limit: number,
) {
  const unique = [
    ...new Set(terms.map((term) => term.trim()).filter((term) => term.length > 1)),
  ].slice(0, 8);

  if (unique.length === 0 || limit <= 0) {
    return Promise.resolve([]);
  }

  return prisma.sourceChunk.findMany({
    where: {
      source: { workspaceId, status: "READY" },
      OR: unique.map((term) => ({
        content: { contains: term, mode: "insensitive" as const },
      })),
    },
    take: limit,
    orderBy: { index: "asc" },
    select: {
      id: true,
      index: true,
      content: true,
      metadata: true,
      source: {
        select: {
          id: true,
          title: true,
          type: true,
        },
      },
    },
  });
}
