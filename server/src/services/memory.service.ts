import { findConversationById } from "../repositories/conversation.repository.js";
import {
  findUserIdByWorkspaceId,
  findWorkspaceByIdAndUserId,
} from "../repositories/workspace.repository.js";
import {
  MEMORY_RECALL_LIMIT,
  addUserMemory,
  deleteUserMemory,
  getMemoryById,
  hasStoredScope,
  listScopedMemories,
  listStoredMemories,
  searchScopedMemories,
  updateMemoryMetadata,
  updateUserMemory,
  type AppMemory,
  type MemoryScope,
} from "../lib/mem0.js";
import { NotFoundError } from "../types/app-error.js";

const classifiedUserIds = new Set<string>();
const classificationTasks = new Map<string, Promise<AppMemory[]>>();

/**
 * Builds the metadata object stored for a scope, keeping existing keys.
 *
 * @param metadata - Current metadata, if any
 * @param scope - Scope to stamp
 * @param workspaceId - Notebook id for workspace scope
 * @returns Metadata with `scope` set and `workspaceId` only for a notebook
 */
function metadataForScope(
  metadata: Record<string, unknown> | null,
  scope: MemoryScope,
  workspaceId?: string,
) {
  const next: Record<string, unknown> = { ...(metadata ?? {}) };
  next.scope = scope;

  if (scope === "workspace" && workspaceId) {
    next.workspaceId = workspaceId;
    return next;
  }

  delete next.workspaceId;
  return next;
}

/**
 * Reads a conversation id from memory metadata.
 *
 * @param metadata - Memory metadata
 * @returns Trimmed conversation id, or `null`
 */
function readConversationId(metadata: Record<string, unknown> | null) {
  const conversationId = metadata?.conversationId;
  if (typeof conversationId !== "string") {
    return null;
  }

  const trimmed = conversationId.trim();
  return trimmed ? trimmed : null;
}

/**
 * Decides the scope for one unscoped memory and stores it.
 *
 * A learned row becomes notebook memory only when its conversation still
 * belongs to a workspace this user owns. Every other row becomes user memory.
 * The returned record is the local view, so callers do not re-read Mem0
 * before the metadata write is visible.
 *
 * @param userId - Owner of the memory
 * @param memory - Unscoped memory row
 * @returns The same memory with scope metadata applied
 */
async function classifyMemory(userId: string, memory: AppMemory): Promise<AppMemory> {
  const conversationId = readConversationId(memory.metadata ?? null);
  let metadata = metadataForScope(memory.metadata ?? null, "user");

  if (conversationId) {
    const conversation = await findConversationById(conversationId);

    if (conversation) {
      const owner = await findUserIdByWorkspaceId(conversation.workspaceId);

      if (owner?.userId === userId) {
        metadata = metadataForScope(
          memory.metadata ?? null,
          "workspace",
          conversation.workspaceId,
        );
      }
    }
  }

  await updateMemoryMetadata(memory.id, metadata);

  const workspaceId =
    typeof metadata.workspaceId === "string" ? metadata.workspaceId : null;

  return {
    ...memory,
    metadata,
    scope: metadata.scope === "workspace" ? "workspace" : "user",
    workspaceId,
  };
}

/**
 * Classifies legacy memories once per user for this process.
 *
 * Later calls return immediately. List and delete still read Mem0 themselves.
 *
 * @param userId - Authenticated user's id
 */
function ensureMemoryScopes(userId: string) {
  if (!process.env.MEM0_API_KEY?.trim() || classifiedUserIds.has(userId)) {
    return Promise.resolve();
  }

  return loadClassifiedMemories(userId).then(() => undefined);
}

/**
 * Loads a user's memories and stamps any row that has no scope.
 *
 * After the first successful pass, later calls only read. A failed pass is
 * not cached. Returns `[]` when Mem0 is not configured.
 *
 * @param userId - Authenticated user's id
 * @returns Memories with scope metadata, using the local stamp for rows just classified
 */
function loadClassifiedMemories(userId: string): Promise<AppMemory[]> {
  if (!process.env.MEM0_API_KEY?.trim()) {
    return Promise.resolve([]);
  }

  if (classifiedUserIds.has(userId)) {
    return listStoredMemories(userId);
  }

  const existing = classificationTasks.get(userId);
  if (existing) {
    return existing;
  }

  const task = (async () => {
    const memories = await listStoredMemories(userId);
    const classified: AppMemory[] = [];

    for (const memory of memories) {
      if (hasStoredScope(memory.metadata)) {
        classified.push(memory);
        continue;
      }

      classified.push(await classifyMemory(userId, memory));
    }

    classifiedUserIds.add(userId);
    return classified;
  })().finally(() => {
    classificationTasks.delete(userId);
  });

  classificationTasks.set(userId, task);
  return task;
}

/**
 * Drops memories that do not belong to the requested scope.
 *
 * @param memories - Rows returned by Mem0
 * @param scope - Scope the caller asked for
 * @param workspaceId - Notebook id for workspace scope
 * @returns Rows that match that scope exactly
 */
function retainScope<T extends AppMemory>(
  memories: T[],
  scope: MemoryScope,
  workspaceId?: string,
) {
  if (scope === "workspace" && workspaceId) {
    return memories.filter(
      (memory) =>
        memory.scope === "workspace" && memory.workspaceId === workspaceId,
    );
  }

  return memories.filter(
    (memory) => memory.scope === "user" && !memory.workspaceId,
  );
}

/**
 * Confirms the user owns the notebook before any workspace memory is touched.
 *
 * @param workspaceId - Notebook to check
 * @param userId - Authenticated user's id
 * @throws {NotFoundError} When the notebook is missing or owned by someone else
 */
async function requireWorkspace(workspaceId: string, userId: string) {
  const workspace = await findWorkspaceByIdAndUserId(workspaceId, userId);

  if (!workspace) {
    throw new NotFoundError("Workspace not found");
  }
}

/**
 * Loads a memory the user owns and confirms it matches the requested scope.
 *
 * @param userId - Authenticated user's id
 * @param memoryId - Mem0 memory id
 * @param workspaceId - Notebook id when the caller is acting on notebook memory
 * @returns The owned memory
 * @throws {NotFoundError} When the memory is missing, owned by someone else, or in the other scope
 */
async function getMemoryForUser(
  userId: string,
  memoryId: string,
  workspaceId?: string,
) {
  if (workspaceId) {
    await requireWorkspace(workspaceId, userId);
  }

  const classified = await loadClassifiedMemories(userId);
  const fromList = classified.find((item) => item.id === memoryId) ?? null;
  const record = await getMemoryById(memoryId);

  if (record?.ownerId && record.ownerId !== userId) {
    throw new NotFoundError("Memory not found");
  }

  if (!record?.ownerId && !fromList) {
    throw new NotFoundError("Memory not found");
  }

  const memory = fromList ?? record;
  if (!memory) {
    throw new NotFoundError("Memory not found");
  }

  const inWorkspace =
    memory.scope === "workspace" && memory.workspaceId === workspaceId;
  const inUserScope = memory.scope === "user" && !memory.workspaceId;

  if (workspaceId ? !inWorkspace : !inUserScope) {
    throw new NotFoundError("Memory not found");
  }

  return memory;
}

/**
 * Lists user memory, or one notebook's memory.
 *
 * @param userId - Authenticated user's id
 * @param workspaceId - Notebook id when listing notebook memory
 * @returns Memories in that scope
 * @throws {NotFoundError} When `workspaceId` is not owned by the user
 */
export async function listMemoriesForUser(userId: string, workspaceId?: string) {
  if (workspaceId) {
    await requireWorkspace(workspaceId, userId);
  }

  const scope = workspaceId ? "workspace" : "user";
  const classified = await loadClassifiedMemories(userId);
  let remote: AppMemory[] = [];

  try {
    remote = await listScopedMemories({
      userId,
      scope,
      workspaceId,
    });
  } catch (error) {
    console.error("Mem0 scoped list failed:", error);
  }
  const byId = new Map<string, AppMemory>();

  for (const memory of retainScope(classified, scope, workspaceId)) {
    byId.set(memory.id, memory);
  }

  for (const memory of retainScope(remote, scope, workspaceId)) {
    if (!byId.has(memory.id)) {
      byId.set(memory.id, memory);
    }
  }

  return [...byId.values()];
}

/**
 * Creates a user-authored memory (not inferred by Mem0).
 *
 * @param userId - Owner of the memory
 * @param input - Memory text and an optional notebook id
 * @returns Created Mem0 memory record
 * @throws {NotFoundError} When `workspaceId` is not owned by the user
 */
export async function createMemoryForUser(
  userId: string,
  input: { memory: string; workspaceId?: string },
) {
  if (input.workspaceId) {
    await requireWorkspace(input.workspaceId, userId);

    return addUserMemory(userId, {
      memory: input.memory,
      infer: false,
      metadata: {
        source: "manual",
        scope: "workspace",
        workspaceId: input.workspaceId,
      },
    });
  }

  return addUserMemory(userId, {
    memory: input.memory,
    infer: false,
    metadata: { source: "manual", scope: "user" },
  });
}

/**
 * Updates the text of a memory in the requested scope.
 *
 * @param userId - Authenticated user's id
 * @param memoryId - Mem0 memory id to update
 * @param input - New memory text
 * @param workspaceId - Notebook id when updating notebook memory
 * @returns Updated Mem0 memory record
 * @throws {NotFoundError} When the memory is missing or outside this scope
 */
export async function updateMemoryForUser(
  userId: string,
  memoryId: string,
  input: { memory: string },
  workspaceId?: string,
) {
  const memory = await getMemoryForUser(userId, memoryId, workspaceId);
  const metadata =
    memory.metadata ??
    metadataForScope(null, memory.scope, memory.workspaceId ?? undefined);

  return updateUserMemory(memoryId, {
    memory: input.memory,
    metadata,
  });
}

/**
 * Deletes a memory in the requested scope.
 *
 * @param userId - Authenticated user's id
 * @param memoryId - Mem0 memory id to delete
 * @param workspaceId - Notebook id when deleting notebook memory
 * @throws {NotFoundError} When the memory is missing or outside this scope
 */
export async function deleteMemoryForUser(
  userId: string,
  memoryId: string,
  workspaceId?: string,
) {
  await getMemoryForUser(userId, memoryId, workspaceId);
  await deleteUserMemory(memoryId);
}

/**
 * Recalls user memory and the current notebook's memory for a chat turn.
 *
 * @param userId - Authenticated user's id
 * @param workspaceId - Notebook the chat belongs to
 * @param query - Current user message
 * @returns Up to {@link MEMORY_RECALL_LIMIT} memory strings, split by scope
 * @throws {NotFoundError} When the notebook is not owned by the user
 */
export async function searchMemoriesForChat(
  userId: string,
  workspaceId: string,
  query: string,
) {
  if (!process.env.MEM0_API_KEY?.trim() || !query.trim()) {
    return { userMemories: [] as string[], workspaceMemories: [] as string[] };
  }

  await requireWorkspace(workspaceId, userId);
  await ensureMemoryScopes(userId);

  const [userResults, workspaceResults] = await Promise.all([
    searchScopedMemories({ userId, query, scope: "user" }),
    searchScopedMemories({
      userId,
      query,
      scope: "workspace",
      workspaceId,
    }),
  ]);

  const ranked = new Map<string, (typeof userResults)[number]>();

  for (const memory of retainScope(userResults, "user")) {
    ranked.set(memory.id, memory);
  }

  for (const memory of retainScope(workspaceResults, "workspace", workspaceId)) {
    const existing = ranked.get(memory.id);
    if (!existing || memory.score > existing.score) {
      ranked.set(memory.id, memory);
    }
  }

  const selected = [...ranked.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, MEMORY_RECALL_LIMIT);

  return {
    userMemories: selected
      .filter((memory) => memory.scope === "user")
      .map((memory) => memory.memory),
    workspaceMemories: selected
      .filter((memory) => memory.scope === "workspace")
      .map((memory) => memory.memory),
  };
}

/**
 * Deletes every notebook memory for a workspace.
 *
 * Best-effort callers should catch errors. Does not call Mem0 `deleteAll`.
 *
 * @param userId - Owner of the notebook
 * @param workspaceId - Notebook whose memories should be removed
 */
export async function deleteMemoriesForWorkspace(
  userId: string,
  workspaceId: string,
) {
  const memories = await loadClassifiedMemories(userId);

  for (const memory of memories) {
    if (memory.workspaceId !== workspaceId) {
      continue;
    }

    await deleteUserMemory(memory.id);
  }
}
