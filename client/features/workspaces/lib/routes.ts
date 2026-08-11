export const workspaceRoutes = {
  list: "/dashboard",
  detail: (id: string) => `/workspace/${id}`,
} as const;

export function isWorkspaceRoute(pathname: string) {
  return (
    pathname === workspaceRoutes.list || pathname.startsWith("/workspace/")
  );
}
