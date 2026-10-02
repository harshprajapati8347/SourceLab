import { requireAuth } from "@/features/auth";
import { SourceDetail } from "@/features/sources";

type SourceDetailPageProps = {
  params: Promise<{ id: string; sourceId: string }>;
};

export default async function SourceDetailPage({
  params,
}: SourceDetailPageProps) {
  await requireAuth();
  const { id, sourceId } = await params;

  return <SourceDetail workspaceId={id} sourceId={sourceId} />;
}
