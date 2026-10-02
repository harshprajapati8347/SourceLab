"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";
import { ApiError, getErrorMessage } from "@/shared/lib/api";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import {
  bulkDeleteSources,
  createSource,
  deleteSource,
  getSource,
  getSourceChunks,
  importWebsiteSource,
  importWebSearchSource,
  importYoutubeSource,
  listSources,
  reprocessSource,
  reprocessSources,
  uploadPdfSource,
} from "../lib/api";
import type {
  CreateSourceInput,
  ImportWebsiteInput,
  ImportYoutubeInput,
  SourceFilters,
} from "../lib/types";

export function sourceKeys(workspaceId: string) {
  return {
    all: ["sources", workspaceId] as const,
    list: (filters?: SourceFilters) =>
      ["sources", workspaceId, "list", filters ?? {}] as const,
    detail: (sourceId: string) => ["sources", workspaceId, sourceId] as const,
  };
}

export function useSources(
  workspaceId: string,
  filters: SourceFilters = {},
  options: { enabled?: boolean } = {},
) {
  const debouncedQuery = useDebouncedValue(filters.q ?? "", 300);
  const queryFilters: SourceFilters = {
    ...filters,
    q: debouncedQuery || undefined,
  };

  return useQuery({
    queryKey: sourceKeys(workspaceId).list(queryFilters),
    queryFn: () => listSources(workspaceId, queryFilters),
    enabled: options.enabled ?? true,
    refetchInterval: (query) => {
      const hasProcessing = query.state.data?.some(
        (source) =>
          source.status === "PENDING" || source.status === "PROCESSING",
      );
      return hasProcessing ? 3000 : false;
    },
  });
}

export function useSourceChunks(
  workspaceId: string,
  sourceId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...sourceKeys(workspaceId).detail(sourceId), "chunks"] as const,
    queryFn: () => getSourceChunks(workspaceId, sourceId),
    enabled,
  });
}

export function useSource(workspaceId: string, sourceId: string) {
  return useQuery({
    queryKey: sourceKeys(workspaceId).detail(sourceId),
    queryFn: () => getSource(workspaceId, sourceId),
    retry: (_, error) => !(error instanceof ApiError && error.status === 404),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "PENDING" || status === "PROCESSING" ? 3000 : false;
    },
  });
}

export function useCreateSource(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateSourceInput) => createSource(workspaceId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: sourceKeys(workspaceId).all,
      });
    },
  });
}

export function useUploadPdfSource(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, title }: { file: File; title?: string }) =>
      uploadPdfSource(workspaceId, file, title),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: sourceKeys(workspaceId).all,
      });
    },
  });
}

export function useImportWebsiteSource(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ImportWebsiteInput) =>
      importWebsiteSource(workspaceId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: sourceKeys(workspaceId).all,
      });
    },
  });
}

export function useImportYoutubeSource(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ImportYoutubeInput) =>
      importYoutubeSource(workspaceId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: sourceKeys(workspaceId).all,
      });
    },
  });
}

export function useDeleteSource(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sourceId: string) => deleteSource(workspaceId, sourceId),
    onError: (error) => {
      toast.add({
        title: "Could not delete the source",
        description: getErrorMessage(error, "Try again in a moment."),
        type: "error",
      });
    },
    onSuccess: (_, sourceId) => {
      toast.add({ title: "Source deleted", type: "success" });
      queryClient.removeQueries({
        queryKey: sourceKeys(workspaceId).detail(sourceId),
      });
      void queryClient.invalidateQueries({
        queryKey: sourceKeys(workspaceId).all,
      });
    },
  });
}

export function useBulkDeleteSources(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sourceIds: string[]) =>
      bulkDeleteSources(workspaceId, sourceIds),
    onError: (error) => {
      toast.add({
        title: "Could not delete the selected sources",
        description: getErrorMessage(error, "Try again in a moment."),
        type: "error",
      });
    },
    onSuccess: (_, sourceIds) => {
      toast.add({
        title:
          sourceIds.length === 1
            ? "Source deleted"
            : `${sourceIds.length} sources deleted`,
        type: "success",
      });
      void queryClient.invalidateQueries({
        queryKey: sourceKeys(workspaceId).all,
      });
    },
  });
}

export function useReprocessSources(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sourceIds?: string[]) =>
      reprocessSources(workspaceId, sourceIds),
    onError: (error) => {
      toast.add({
        title: "Could not start reprocessing",
        description: getErrorMessage(error, "Try again in a moment."),
        type: "error",
      });
    },
    onSuccess: (result) => {
      toast.add({
        title:
          result.reprocessed === 1
            ? "Reprocessing 1 source"
            : `Reprocessing ${result.reprocessed} sources`,
        type: "success",
      });
      void queryClient.invalidateQueries({
        queryKey: sourceKeys(workspaceId).all,
      });
    },
  });
}

export function useReprocessSource(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sourceId: string) => reprocessSource(workspaceId, sourceId),
    onError: (error) => {
      toast.add({
        title: "Could not start reprocessing",
        description: getErrorMessage(error, "Try again in a moment."),
        type: "error",
      });
    },
    onSuccess: (_, sourceId) => {
      toast.add({ title: "Reprocessing the source", type: "success" });
      void queryClient.invalidateQueries({
        queryKey: sourceKeys(workspaceId).detail(sourceId),
      });
      void queryClient.invalidateQueries({
        queryKey: sourceKeys(workspaceId).all,
      });
    },
  });
}

export function useImportWebSearchSource(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { title: string; content: string; url: string }) =>
      importWebSearchSource(workspaceId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: sourceKeys(workspaceId).all,
      });
    },
  });
}
