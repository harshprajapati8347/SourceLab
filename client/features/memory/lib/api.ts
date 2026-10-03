import { apiFetch } from "@/shared/lib/api";
import type { CreateMemoryInput, UpdateMemoryInput, UserMemory } from "./types";

function memoryCollectionPath(workspaceId?: string) {
  if (!workspaceId) {
    return "/api/memory";
  }

  return `/api/memory?workspaceId=${encodeURIComponent(workspaceId)}`;
}

function memoryItemPath(memoryId: string, workspaceId?: string) {
  const path = `/api/memory/${encodeURIComponent(memoryId)}`;

  if (!workspaceId) {
    return path;
  }

  return `${path}?workspaceId=${encodeURIComponent(workspaceId)}`;
}

export function listMemories(workspaceId?: string) {
  return apiFetch<UserMemory[]>(memoryCollectionPath(workspaceId));
}

export function createMemory(input: CreateMemoryInput) {
  return apiFetch<UserMemory>("/api/memory", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateMemory(
  memoryId: string,
  input: UpdateMemoryInput,
  workspaceId?: string,
) {
  return apiFetch<UserMemory>(memoryItemPath(memoryId, workspaceId), {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteMemory(memoryId: string, workspaceId?: string) {
  return apiFetch<void>(memoryItemPath(memoryId, workspaceId), {
    method: "DELETE",
  });
}
