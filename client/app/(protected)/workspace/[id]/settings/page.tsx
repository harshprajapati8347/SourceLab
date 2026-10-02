import { notFound } from "next/navigation";
import { requireAuth } from "@/features/auth";
import { getWorkspaceOrNull } from "@/features/workspaces/lib/workspace-server";
import { WorkspaceSettingsForm } from "@/features/workspaces/components/workspace-settings-form";

type WorkspaceSettingsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function WorkspaceSettingsPage({
  params,
}: WorkspaceSettingsPageProps) {
  await requireAuth();
  const { id } = await params;
  const workspace = await getWorkspaceOrNull(id);

  if (!workspace) {
    notFound();
  }

  return <WorkspaceSettingsForm workspace={workspace} />;
}
