import type { Prisma } from "../generated/prisma/client.js";
import prisma from "../lib/db.js";
import type { ListSourcesQuery } from "../validators/source.validator.js";

export const sourceSelect = {
  id: true,
  workspaceId: true,
  type: true,
  title: true,
  content: true,
  url: true,
  status: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type SourceRecord = Prisma.SourceGetPayload<{
  select: typeof sourceSelect;
}>;

export type CreateSourceData = {
  workspaceId: string;
  type: SourceRecord["type"];
  title: string;
  content?: string | null;
  url?: string | null;
  status?: SourceRecord["status"];
  metadata?: Prisma.InputJsonValue;
};

export function findSourcesByWorkspaceId(
  workspaceId: string,
  filters: ListSourcesQuery = {},
) {
  const where: Prisma.SourceWhereInput = { workspaceId };

  if (filters.type) {
    where.type = filters.type;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: "insensitive" } },
      { content: { contains: filters.q, mode: "insensitive" } },
    ];
  }

  return prisma.source.findMany({
    where,
    select: sourceSelect,
    orderBy: { createdAt: "desc" },
  });
}

export function findSourceByIdAndWorkspaceId(
  sourceId: string,
  workspaceId: string,
) {
  return prisma.source.findFirst({
    where: { id: sourceId, workspaceId },
    select: sourceSelect,
  });
}

export function createSourceRecord(data: CreateSourceData) {
  return prisma.source.create({
    data: {
      workspaceId: data.workspaceId,
      type: data.type,
      title: data.title,
      content: data.content ?? null,
      url: data.url ?? null,
      status: data.status ?? "PENDING",
      metadata: data.metadata,
    },
    select: sourceSelect,
  });
}

export const sourceAuthoritySelect = {
  id: true,
  type: true,
  metadata: true,
  createdAt: true,
} as const;

export type SourceAuthorityRecord = Prisma.SourceGetPayload<{
  select: typeof sourceAuthoritySelect;
}>;

/**
 * Loads the fields needed to score authority and freshness for retrieved chunks.
 *
 * @param workspaceId - Workspace that owns the sources
 * @param sourceIds - Source ids referenced by the current retrieval set
 * @returns Matching source rows, or an empty list when `sourceIds` is empty
 */
export function findSourcesByIds(workspaceId: string, sourceIds: string[]) {
  const ids = [...new Set(sourceIds)];
  if (ids.length === 0) {
    return Promise.resolve([] as SourceAuthorityRecord[]);
  }

  return prisma.source.findMany({
    where: { workspaceId, id: { in: ids } },
    select: sourceAuthoritySelect,
  });
}

export function findSourceById(sourceId: string) {
  return prisma.source.findUnique({
    where: { id: sourceId },
    select: sourceSelect,
  });
}

export function updateSourceRecord(
  sourceId: string,
  data: {
    content?: string | null;
    status?: SourceRecord["status"];
    metadata?: Prisma.InputJsonValue;
  },
) {
  return prisma.source.update({
    where: { id: sourceId },
    data,
    select: sourceSelect,
  });
}

export async function deleteSourceRecord(sourceId: string) {
  await prisma.source.delete({
    where: { id: sourceId },
  });
}
