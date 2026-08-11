import { requireAuth, SignOutButton } from "@/features/auth";
import { WorkspaceList } from "@/features/workspaces";

export default async function DashboardPage() {
  await requireAuth();

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-8 p-6 md:p-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Manage your SourceLab AI workspaces.
          </p>
        </div>
        <SignOutButton />
      </div>

      <WorkspaceList />
    </div>
  );
}
