"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createMemory,
  deleteMemory,
  listMemories,
  updateMemory,
} from "../lib/api";
import type { CreateMemoryInput, UpdateMemoryInput } from "../lib/types";

export const memoryKeys = {
  all: ["memory"] as const,
  list: (workspaceId?: string | null) =>
    ["memory", "list", workspaceId ?? "user"] as const,
};

export function useMemories(workspaceId?: string | null) {
  return useQuery({
    queryKey: memoryKeys.list(workspaceId),
    queryFn: () => listMemories(workspaceId ?? undefined),
  });
}

export function useCreateMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateMemoryInput) => createMemory(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: memoryKeys.all });
    },
  });
}

export function useUpdateMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      memoryId,
      input,
      workspaceId,
    }: {
      memoryId: string;
      input: UpdateMemoryInput;
      workspaceId?: string | null;
    }) => updateMemory(memoryId, input, workspaceId ?? undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: memoryKeys.all });
    },
  });
}

export function useDeleteMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      memoryId,
      workspaceId,
    }: {
      memoryId: string;
      workspaceId?: string | null;
    }) => deleteMemory(memoryId, workspaceId ?? undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: memoryKeys.all });
    },
  });
}
