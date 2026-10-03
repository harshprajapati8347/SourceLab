"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAppRouter } from "@/shared/hooks/use-app-router";
import { PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { billingRoutes } from "@/features/billing/lib/routes";
import { useBilling } from "@/features/billing/hooks/use-billing";
import { formatCreditCount } from "@/features/billing/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { ApiError } from "@/shared/lib/api";
import { useUIStore } from "@/shared/stores/ui-store";
import {
  useCreateWorkspace,
  useDeleteWorkspace,
  useUpdateWorkspace,
  useWorkspaces,
} from "../hooks/use-workspaces";
import { workspaceRoutes } from "../lib/routes";
import type { Workspace } from "../lib/types";
import { AppHeader } from "./app-header";
import { AppOverlays } from "./app-overlays";
import { CreateWorkspaceCard } from "./create-workspace-card";
import { DeleteWorkspaceDialog } from "./delete-workspace-dialog";
import { WorkspaceCard } from "./workspace-card";
import { WorkspaceFormDialog } from "./workspace-form-dialog";

type DashboardHomeProps = {
  userName?: string | null;
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function StatStrip({ notebookCount }: { notebookCount: number | undefined }) {
  const { data: billing, isLoading } = useBilling();

  return (
    <dl className="grid grid-cols-3 divide-x rounded-xl border bg-card">
      <div className="px-4 py-3">
        <dt className="text-xs text-muted-foreground">Notebooks</dt>
        <dd className="mt-0.5 font-heading text-xl font-semibold tabular-nums">
          {notebookCount ?? <Skeleton className="mt-1 h-6 w-8" />}
        </dd>
      </div>
      <Link
        href={billingRoutes.settings}
        className="group px-4 py-3 outline-none transition-colors duration-200 hover:bg-muted/50 focus-visible:bg-muted/50"
      >
        <dt className="text-xs text-muted-foreground">Credits left</dt>
        <dd className="mt-0.5 font-heading text-xl font-semibold tabular-nums">
          {isLoading ? (
            <Skeleton className="mt-1 h-6 w-10" />
          ) : billing ? (
            formatCreditCount(billing.credits)
          ) : (
            "-"
          )}
        </dd>
      </Link>
      <div className="px-4 py-3">
        <dt className="text-xs text-muted-foreground">Plan</dt>
        <dd className="mt-0.5 font-heading text-xl font-semibold">
          {isLoading ? (
            <Skeleton className="mt-1 h-6 w-12" />
          ) : billing ? (
            billing.plan === "pro" ? (
              "Pro"
            ) : (
              "Free"
            )
          ) : (
            "-"
          )}
        </dd>
      </div>
    </dl>
  );
}

export function DashboardHome({ userName }: DashboardHomeProps) {
  const router = useAppRouter();
  const { data: workspaces, isLoading, error, refetch } = useWorkspaces();
  const createWorkspace = useCreateWorkspace();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);

  const createOpen = useUIStore((state) => state.createWorkspaceOpen);
  const setCreateOpen = useUIStore((state) => state.setCreateWorkspaceOpen);

  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(
    null,
  );
  const [deletingWorkspace, setDeletingWorkspace] = useState<Workspace | null>(
    null,
  );

  const updateWorkspace = useUpdateWorkspace(editingWorkspace?.id ?? "");
  const deleteWorkspace = useDeleteWorkspace();

  const filteredWorkspaces = useMemo(() => {
    if (!workspaces) {
      return [];
    }

    const query = debouncedSearch.trim().toLowerCase();
    if (!query) {
      return workspaces;
    }

    return workspaces.filter((workspace) =>
      [workspace.title, workspace.description ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [workspaces, debouncedSearch]);

  const firstName = userName?.trim().split(/\s+/)[0];
  const isSearching = debouncedSearch.trim().length > 0;
  const hasNoNotebooks = !isLoading && !error && workspaces?.length === 0;

  return (
    <div className="min-h-svh bg-background">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
        <section className="mb-8 grid gap-6 md:grid-cols-[1fr_minmax(0,22rem)] md:items-end">
          <div className="space-y-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">
              {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
            </h1>
            <p className="max-w-lg text-sm text-muted-foreground">
              Open a notebook to ask questions of your sources, or start a new
              one.
            </p>
          </div>
          <StatStrip notebookCount={workspaces?.length} />
        </section>

        <section aria-labelledby="notebooks-heading" className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2
              id="notebooks-heading"
              className="font-heading text-base font-semibold"
            >
              Notebooks
            </h2>

            <div className="flex items-center gap-2" suppressHydrationWarning>
              <div className="relative w-full sm:w-64">
                <SearchIcon
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search notebooks"
                  aria-label="Search notebooks"
                  className="h-9 rounded-full pr-8 pl-9"
                />
                {search ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setSearch("")}
                    className="absolute top-1/2 right-2.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                ) : null}
              </div>
              <Button
                className="shrink-0"
                size="lg"
                onClick={() => setCreateOpen(true)}
              >
                <PlusIcon />
                New notebook
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              aria-busy="true"
              aria-label="Loading notebooks"
            >
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="min-h-44 rounded-xl" />
              ))}
            </div>
          ) : error && !workspaces ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>Could not load your notebooks</EmptyTitle>
                <EmptyDescription>
                  {errorMessage(error, "Check your connection and try again.")}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => void refetch()}>Try again</Button>
              </EmptyContent>
            </Empty>
          ) : hasNoNotebooks ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>Start your first notebook</EmptyTitle>
                <EmptyDescription>
                  Add PDFs, web pages, or videos, then ask questions and get
                  answers with citations.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="lg" onClick={() => setCreateOpen(true)}>
                  <PlusIcon />
                  Create a notebook
                </Button>
              </EmptyContent>
            </Empty>
          ) : isSearching && filteredWorkspaces.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>
                  No notebook matches “{debouncedSearch.trim()}”
                </EmptyTitle>
                <EmptyDescription>
                  Try a different word, or clear the search.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" onClick={() => setSearch("")}>
                  Clear search
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredWorkspaces.map((workspace) => (
                <li key={workspace.id} className="flex">
                  <WorkspaceCard
                    workspace={workspace}
                    className="w-full"
                    onEdit={setEditingWorkspace}
                    onDelete={setDeletingWorkspace}
                  />
                </li>
              ))}
              {!isSearching ? (
                <li className="flex">
                  <CreateWorkspaceCard
                    className="w-full"
                    onClick={() => setCreateOpen(true)}
                  />
                </li>
              ) : null}
            </ul>
          )}
        </section>
      </main>

      <WorkspaceFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        isPending={createWorkspace.isPending}
        onSubmit={async (values) => {
          const workspace = await createWorkspace.mutateAsync(values);
          toast.add({ title: "Notebook created", type: "success" });
          router.push(workspaceRoutes.detail(workspace.id));
        }}
      />

      <WorkspaceFormDialog
        open={Boolean(editingWorkspace)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingWorkspace(null);
          }
        }}
        workspace={editingWorkspace}
        isPending={updateWorkspace.isPending}
        onSubmit={async (values) => {
          await updateWorkspace.mutateAsync(values);
          toast.add({ title: "Notebook updated", type: "success" });
        }}
      />

      <DeleteWorkspaceDialog
        workspace={deletingWorkspace}
        open={Boolean(deletingWorkspace)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingWorkspace(null);
          }
        }}
        isPending={deleteWorkspace.isPending}
        onConfirm={async () => {
          if (!deletingWorkspace) {
            return;
          }

          try {
            await deleteWorkspace.mutateAsync(deletingWorkspace.id);
            toast.add({ title: "Notebook deleted", type: "success" });
            setDeletingWorkspace(null);
          } catch (deleteError) {
            toast.add({
              title: "Could not delete the notebook",
              description: errorMessage(deleteError, "Try again in a moment."),
              type: "error",
            });
          }
        }}
      />

      <AppOverlays />
    </div>
  );
}
