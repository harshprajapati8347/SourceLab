import { notFound } from "next/navigation";
import { requireAuth } from "@/features/auth";
import { WorkspaceShell } from "@/features/workspaces";
import { getWorkspaceOrNull } from "@/features/workspaces/lib/workspace-server";

type WorkspaceLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  await requireAuth();
  const { id } = await params;
  const workspace = await getWorkspaceOrNull(id);

  if (!workspace) {
    notFound();
  }

  return <WorkspaceShell workspace={workspace}>{children}</WorkspaceShell>;
}
