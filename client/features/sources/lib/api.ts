import { ApiError, apiFetch } from "@/shared/lib/api";
import type {
  CreateSourceInput,
  ImportWebsiteInput,
  ImportYoutubeInput,
  Source,
  SourceFilters,
} from "./types";

function buildSourcesPath(workspaceId: string, filters?: SourceFilters) {
  const params = new URLSearchParams();

  if (filters?.q) {
    params.set("q", filters.q);
  }

  if (filters?.type) {
    params.set("type", filters.type);
  }

  if (filters?.status) {
    params.set("status", filters.status);
  }

  const query = params.toString();
  return `/api/workspaces/${workspaceId}/sources${query ? `?${query}` : ""}`;
}

export function listSources(workspaceId: string, filters?: SourceFilters) {
  return apiFetch<Source[]>(buildSourcesPath(workspaceId, filters));
}

export function getSource(workspaceId: string, sourceId: string) {
  return apiFetch<Source>(`/api/workspaces/${workspaceId}/sources/${sourceId}`);
}

export function createSource(workspaceId: string, input: CreateSourceInput) {
  return apiFetch<Source>(`/api/workspaces/${workspaceId}/sources`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function importWebsiteSource(
  workspaceId: string,
  input: ImportWebsiteInput,
) {
  return apiFetch<Source>(
    `/api/workspaces/${workspaceId}/sources/import/website`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function importYoutubeSource(
  workspaceId: string,
  input: ImportYoutubeInput,
) {
  return apiFetch<Source>(
    `/api/workspaces/${workspaceId}/sources/import/youtube`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function uploadPdfSource(
  workspaceId: string,
  file: File,
  title?: string,
) {
  const formData = new FormData();
  formData.append("file", file);

  if (title?.trim()) {
    formData.append("title", title.trim());
  }

  const response = await fetch(
    `/api/workspaces/${workspaceId}/sources/upload`,
    {
      method: "POST",
      credentials: "include",
      body: formData,
    },
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      (data as { error?: string } | null)?.error ?? "Upload failed",
      (data as { details?: unknown } | null)?.details,
    );
  }

  return data as Source;
}

export function deleteSource(workspaceId: string, sourceId: string) {
  return apiFetch<void>(`/api/workspaces/${workspaceId}/sources/${sourceId}`, {
    method: "DELETE",
  });
}
