type MemorySourceFilter = "manual" | "learned";

/** Builds `/settings/memory`, including a notebook id and source filter when set. */
export function memorySettingsHref(input?: {
  workspaceId?: string | null;
  source?: MemorySourceFilter | null;
}) {
  const params = new URLSearchParams();

  if (input?.workspaceId) {
    params.set("workspaceId", input.workspaceId);
  }

  if (input?.source) {
    params.set("source", input.source);
  }

  const query = params.toString();
  return query ? `/settings/memory?${query}` : "/settings/memory";
}

export const memoryRoutes = {
  settings: "/settings/memory",
  manual: "/settings/memory?source=manual",
  learned: "/settings/memory?source=learned",
  href: memorySettingsHref,
} as const;
