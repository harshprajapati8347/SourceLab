import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireAuth } from "@/features/auth";
import { WorkspaceChat } from "@/features/chat";
import { getWorkspaceOrNull } from "@/features/workspaces/lib/workspace-server";

type WorkspacePageProps = {
  params: Promise<{ id: string }>;
};

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  await requireAuth();
  const { id } = await params;
  const workspace = await getWorkspaceOrNull(id);

  if (!workspace) {
    notFound();
  }

  return (
    <Suspense fallback={null}>
      <WorkspaceChat
        workspaceId={workspace.id}
        defaultModel={workspace.defaultModel}
      />
    </Suspense>
  );
}
