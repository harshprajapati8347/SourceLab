export const sourceRoutes = {
  list: (workspaceId: string) => `/workspace/${workspaceId}/sources`,
  detail: (workspaceId: string, sourceId: string, chunkId?: string) => {
    const path = `/workspace/${workspaceId}/sources/${sourceId}`;
    return chunkId
      ? `${path}?chunk=${encodeURIComponent(chunkId)}`
      : path;
  },
} as const;
