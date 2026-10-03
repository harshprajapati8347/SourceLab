import { requireAuth } from "@/features/auth";
import { MemorySettings } from "@/features/memory";

type MemorySettingsPageProps = {
  searchParams: Promise<{ source?: string; workspaceId?: string }>;
};

export default async function MemorySettingsPage({
  searchParams,
}: MemorySettingsPageProps) {
  await requireAuth();
  const { source, workspaceId } = await searchParams;
  const sourceFilter =
    source === "manual" || source === "learned" ? source : null;
  const notebookId = workspaceId?.trim() ? workspaceId : null;

  return (
    <MemorySettings sourceFilter={sourceFilter} workspaceId={notebookId} />
  );
}
