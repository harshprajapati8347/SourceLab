import { requireAuth } from "@/features/auth";
import { ArtifactDetail } from "@/features/learn";

type ArtifactPageProps = {
  params: Promise<{ id: string; artifactId: string }>;
};

export default async function ArtifactPage({ params }: ArtifactPageProps) {
  await requireAuth();
  const { id, artifactId } = await params;

  return <ArtifactDetail workspaceId={id} artifactId={artifactId} />;
}
