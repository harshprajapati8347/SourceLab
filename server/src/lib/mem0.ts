import { MemoryClient, MemoryNotFoundError } from "mem0ai";

let client: MemoryClient | null = null;

/** Memories recalled into one chat turn, across both scopes. */
export const MEMORY_RECALL_LIMIT = 8;

const MEMORY_PAGE_SIZE = 100;
const MEMORY_MAX_PAGES = 20;

/**
 * Returns a singleton Mem0 API client.
 *
 * @returns Configured `MemoryClient`
 * @throws When `MEM0_API_KEY` is missing
 */
export function getMem0Client() {
  const apiKey = process.env.MEM0_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("MEM0_API_KEY is not configured");
  }

  if (!client) {
    client = new MemoryClient({ apiKey });
  }

  return client;
}

/** Message shape accepted by Mem0 for inferred memory extraction. */
export type Mem0Message = {
  role: "user" | "assistant";
  content: string;
};

/** Who a memory is visible to. */
export type MemoryScope = "user" | "workspace";

/** Normalized memory record returned by SourceLab memory APIs. */
export type AppMemory = {
  id: string;
  memory: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown> | null;
  categories?: string[];
  source: "manual" | "learned";
  scope: MemoryScope;
  workspaceId: string | null;
};

/** Search hit with the Mem0 relevance score used to cap the combined recall list. */
export type RankedMemory = AppMemory & {
  score: number;
};

/** Memory plus the Mem0 `user_id`, when the record includes one. */
export type OwnedMemory = AppMemory & {
  ownerId: string | null;
};

/**
 * Reads Mem0 metadata into a plain object.
 *
 * @param metadata - Raw metadata from a Mem0 record
 * @returns The object, or `null` when metadata is missing or not an object
 */
function asMetadata(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  return metadata as Record<string, unknown>;
}

/**
 * Reads a notebook id stored on memory metadata.
 *
 * @param metadata - Memory metadata
 * @returns Trimmed workspace id, or `null` when it is absent
 */
function readWorkspaceId(metadata: Record<string, unknown> | null) {
  const workspaceId = metadata?.workspaceId;
  if (typeof workspaceId !== "string") {
    return null;
  }

  const trimmed = workspaceId.trim();
  return trimmed ? trimmed : null;
}

/**
 * Derives scope from metadata.
 *
 * A notebook id never counts as user memory. A user tag with no notebook id
 * stays user memory. Anything else without a notebook id stays user memory so
 * an unscoped legacy row is not hidden before classification.
 *
 * @param metadata - Memory metadata
 * @returns Scope and notebook id that reads are allowed to trust
 */
function deriveScope(metadata: Record<string, unknown> | null): {
  scope: MemoryScope;
  workspaceId: string | null;
} {
  const workspaceId = readWorkspaceId(metadata);
  const stored = metadata?.scope;

  if (stored === "workspace" && workspaceId) {
    return { scope: "workspace", workspaceId };
  }

  if (stored === "user" && !workspaceId) {
    return { scope: "user", workspaceId: null };
  }

  if (workspaceId) {
    return { scope: "workspace", workspaceId };
  }

  return { scope: "user", workspaceId: null };
}

/**
 * Maps a raw Mem0 record into the app's {@link AppMemory} shape.
 *
 * @param record - Raw Mem0 memory object
 * @returns Normalized memory with `source` and `scope` derived from metadata
 */
function mapMemory(record: {
  id: string;
  memory?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  metadata?: Record<string, unknown> | null;
  categories?: string[];
}): AppMemory {
  const metadata = asMetadata(record.metadata);
  const source: AppMemory["source"] =
    metadata?.source === "manual" ? "manual" : "learned";
  const { scope, workspaceId } = deriveScope(metadata);
  const createdAt = record.createdAt ?? new Date().toISOString();
  const updatedAt = record.updatedAt ?? createdAt;

  return {
    id: record.id,
    memory: record.memory ?? "",
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt,
    updatedAt: updatedAt instanceof Date ? updatedAt.toISOString() : updatedAt,
    metadata,
    categories: record.categories,
    source,
    scope,
    workspaceId,
  };
}

/**
 * Whether metadata already has a scope tag. Classification leaves these rows alone.
 *
 * @param metadata - Memory metadata
 * @returns `true` when `scope` is `user` or `workspace`
 */
export function hasStoredScope(metadata: Record<string, unknown> | null | undefined) {
  return metadata?.scope === "user" || metadata?.scope === "workspace";
}

/**
 * Mem0 filter for one user's memories in a single scope.
 *
 * @param userId - Authenticated user's id
 * @param scope - Memory scope to read
 * @param workspaceId - Notebook id, required for workspace scope
 * @returns Filter object passed to Mem0 `getAll` and `search`
 */
function scopeFilters(
  userId: string,
  scope: MemoryScope,
  workspaceId?: string,
) {
  if (scope === "workspace" && workspaceId) {
    return {
      AND: [
        { user_id: userId },
        { metadata: { scope: "workspace", workspaceId } },
      ],
    };
  }

  return {
    AND: [{ user_id: userId }, { metadata: { scope: "user" } }],
  };
}

/**
 * Pages through Mem0 `getAll` until a short page or the page cap.
 *
 * @param filters - Mem0 filter object
 * @returns Memories from those pages, de-duplicated by id
 */
async function collectMemories(filters: Record<string, unknown>) {
  if (!process.env.MEM0_API_KEY?.trim()) {
    return [];
  }

  const collected: AppMemory[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= MEMORY_MAX_PAGES; page += 1) {
    const result = await getMem0Client().getAll({
      filters,
      page,
      pageSize: MEMORY_PAGE_SIZE,
    });
    let added = 0;

    for (const record of result.results) {
      const memory = mapMemory(record);
      if (seen.has(memory.id)) {
        continue;
      }

      seen.add(memory.id);
      collected.push(memory);
      added += 1;
    }

    if (added === 0 || result.results.length < MEMORY_PAGE_SIZE) {
      break;
    }
  }

  return collected;
}

/**
 * Lists every memory stored for a user, including rows that have no scope yet.
 *
 * @param userId - Authenticated user's id
 * @returns Memories for that `user_id`, or `[]` when Mem0 is not configured
 */
export function listStoredMemories(userId: string) {
  return collectMemories({ user_id: userId });
}

/**
 * Lists memories for one scope using Mem0 metadata filters.
 *
 * @param input - User, scope, and notebook id for workspace scope
 * @returns Memories matching the filter, or `[]` when Mem0 is not configured
 */
export function listScopedMemories(input: {
  userId: string;
  scope: MemoryScope;
  workspaceId?: string;
}) {
  return collectMemories(
    scopeFilters(input.userId, input.scope, input.workspaceId),
  );
}

/**
 * Semantic search over one memory scope.
 *
 * Callers still drop rows that do not match. Search uses these filters so a
 * notebook memory cannot fill the recall list for a different notebook.
 *
 * @param input - User, query, scope, and notebook id for workspace scope
 * @returns Up to {@link MEMORY_RECALL_LIMIT} hits, or `[]` when Mem0 is off or the query is empty
 */
export async function searchScopedMemories(input: {
  userId: string;
  query: string;
  scope: MemoryScope;
  workspaceId?: string;
}): Promise<RankedMemory[]> {
  if (!process.env.MEM0_API_KEY?.trim() || !input.query.trim()) {
    return [];
  }

  const results = await getMem0Client().search(input.query, {
    filters: scopeFilters(input.userId, input.scope, input.workspaceId),
    topK: MEMORY_RECALL_LIMIT,
    threshold: 0.1,
  });

  return results.results.map((record) => ({
    ...mapMemory(record),
    score: typeof record.score === "number" ? record.score : 0,
  }));
}

/**
 * Loads one memory by id.
 *
 * @param memoryId - Mem0 memory id
 * @returns The memory and its `user_id`, or `null` when Mem0 has no such record
 * @throws When Mem0 is not configured or the request fails for another reason
 */
export async function getMemoryById(memoryId: string): Promise<OwnedMemory | null> {
  try {
    const record = await getMem0Client().get(memoryId);
    const ownerId = record.userId?.trim() || null;

    return {
      ...mapMemory(record),
      ownerId,
    };
  } catch (error) {
    if (error instanceof MemoryNotFoundError) {
      return null;
    }

    throw error;
  }
}

/**
 * Reads the first memory from a Mem0 add response.
 *
 * v3 returns `{ results: [{ id, data: { memory } }] }` when `infer` is false.
 * Older responses are a bare array or a single memory object.
 *
 * @param response - Raw add response after the SDK's key conversion
 * @returns The first memory record, or `null` when the response has none
 */
function firstAddedMemory(response: unknown) {
  if (Array.isArray(response)) {
    return isMemoryRecord(response[0]) ? response[0] : null;
  }

  if (!isMemoryRecord(response)) {
    return null;
  }

  if (Array.isArray(response.results)) {
    return isMemoryRecord(response.results[0]) ? response.results[0] : null;
  }

  return typeof response.id === "string" ? response : null;
}

function isMemoryRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Creates a single user memory (manual or explicit text).
 *
 * @param userId - Owner of the memory
 * @param input - Memory text, optional infer flag, optional metadata
 * @returns Created memory record
 * @throws When Mem0 returns no created record
 */
export async function addUserMemory(
  userId: string,
  input: {
    memory: string;
    infer?: boolean;
    metadata?: Record<string, unknown>;
  },
) {
  const created = await getMem0Client().add(
    [{ role: "user", content: input.memory }],
    {
      userId,
      infer: input.infer ?? false,
      metadata: input.metadata,
    },
  );

  const first = firstAddedMemory(created);
  const id = typeof first?.id === "string" ? first.id : "";
  if (!first || !id) {
    throw new Error("Mem0 did not return a created memory");
  }

  const data = isMemoryRecord(first.data) ? first.data : null;
  const nestedMemory = typeof data?.memory === "string" ? data.memory : "";

  return mapMemory({
    id,
    memory:
      (typeof first.memory === "string" && first.memory) ||
      nestedMemory ||
      input.memory,
    createdAt: first.createdAt as Date | string | undefined,
    updatedAt: first.updatedAt as Date | string | undefined,
    metadata: asMetadata(first.metadata) ?? input.metadata ?? null,
    categories: Array.isArray(first.categories)
      ? first.categories.filter((category): category is string => typeof category === "string")
      : undefined,
  });
}

/**
 * Extracts inferred memories from a conversation transcript (fire-and-forget in chat).
 *
 * @param userId - Owner of extracted memories
 * @param messages - Recent user/assistant turns
 * @param metadata - Optional metadata (source, scope, workspaceId, conversationId)
 * @returns Resolves immediately when Mem0 is off or messages are empty
 */
export async function addMemoriesFromMessages(
  userId: string,
  messages: Mem0Message[],
  metadata?: Record<string, unknown>,
) {
  if (!process.env.MEM0_API_KEY?.trim() || messages.length === 0) {
    return;
  }

  await getMem0Client().add(messages, {
    userId,
    infer: true,
    metadata,
  });
}

/**
 * Replaces custom metadata on an existing memory without changing its text.
 *
 * @param memoryId - Mem0 memory id
 * @param metadata - Full metadata object to store
 */
export async function updateMemoryMetadata(
  memoryId: string,
  metadata: Record<string, unknown>,
) {
  await getMem0Client().update(memoryId, { metadata });
}

/**
 * Updates the text of an existing memory by id.
 *
 * @param memoryId - Mem0 memory id
 * @param input - New memory text and the metadata to keep on the record
 * @returns Updated memory record
 * @throws When Mem0 returns no updated record
 */
export async function updateUserMemory(
  memoryId: string,
  input: { memory: string; metadata?: Record<string, unknown> },
) {
  const updated = await getMem0Client().update(memoryId, {
    text: input.memory,
    ...(input.metadata ? { metadata: input.metadata } : {}),
  });

  const first = updated[0];
  if (!first) {
    throw new Error("Mem0 did not return an updated memory");
  }

  return mapMemory(first);
}

/**
 * Permanently deletes a memory from Mem0.
 *
 * @param memoryId - Mem0 memory id to delete
 * @returns Resolves when deletion completes
 */
export async function deleteUserMemory(memoryId: string) {
  await getMem0Client().delete(memoryId);
}
