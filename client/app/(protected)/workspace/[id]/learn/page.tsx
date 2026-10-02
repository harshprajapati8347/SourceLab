import { requireAuth } from "@/features/auth";
import { LearnHub } from "@/features/learn";

type LearnPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LearnPage({ params }: LearnPageProps) {
  await requireAuth();
  const { id } = await params;

  return <LearnHub workspaceId={id} />;
}
