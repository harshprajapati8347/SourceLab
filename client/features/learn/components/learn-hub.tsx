"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { PlusIcon, Trash2Icon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { PageHeader } from "@/shared/components/page-header";
import { getErrorMessage } from "@/shared/lib/api";
import { ARTIFACT_TYPE_LABELS } from "../lib/constants";
import { learnRoutes } from "../lib/routes";
import type { LearningArtifact } from "../lib/types";
import { useArtifacts, useDeleteArtifact } from "../hooks/use-artifacts";
import { ArtifactStatusBadge } from "./artifact-status-badge";
import { ArtifactTypeIcon } from "./artifact-type-icon";
import { GenerateArtifactDialog } from "./generate-artifact-dialog";

type LearnHubProps = {
  workspaceId: string;
};

export function LearnHub({ workspaceId }: LearnHubProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<LearningArtifact | null>(null);
  const {
    data: artifacts = [],
    isLoading,
    error,
    refetch,
  } = useArtifacts(workspaceId);
  const deleteArtifact = useDeleteArtifact(workspaceId);

  async function confirmDelete() {
    if (!deleting) {
      return;
    }

    try {
      await deleteArtifact.mutateAsync(deleting.id);
      toast.add({ title: "Study tool deleted", type: "success" });
      setDeleting(null);
    } catch (deleteError) {
      toast.add({
        title: "Could not delete it",
        description: getErrorMessage(deleteError, "Try again in a moment."),
        type: "error",
      });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-8">
      <PageHeader
        title="Learn"
        description="Turn your sources into summaries, flashcards, quizzes, mind maps, and reports."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <PlusIcon />
            Generate
          </Button>
        }
      />

      {isLoading ? (
        <div
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
          aria-busy="true"
          aria-label="Loading study tools"
        >
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : error && artifacts.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Could not load study tools</EmptyTitle>
            <EmptyDescription>
              {getErrorMessage(error, "Check your connection and try again.")}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => void refetch()}>Try again</Button>
          </EmptyContent>
        </Empty>
      ) : artifacts.length === 0 ? (
        <Empty className="border border-dashed py-16">
          <EmptyHeader>
            <EmptyTitle>Nothing generated yet</EmptyTitle>
            <EmptyDescription>
              Pick a format and SourceLab builds it from the sources in this
              notebook.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setDialogOpen(true)}>
              <PlusIcon />
              Generate your first study tool
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {artifacts.map((artifact) => (
            <li key={artifact.id} className="flex">
              <article className="group relative flex w-full flex-col gap-3 rounded-xl border bg-card p-4 transition-colors duration-200 ease-house focus-within:border-primary/40 hover:border-primary/40">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:bg-primary/10 group-hover:text-primary-ink">
                    <ArtifactTypeIcon type={artifact.type} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold">
                      <Link
                        href={learnRoutes.detail(workspaceId, artifact.id)}
                        className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-ring/40"
                      >
                        {artifact.title}
                      </Link>
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {ARTIFACT_TYPE_LABELS[artifact.type]} ·{" "}
                      {formatDistanceToNow(new Date(artifact.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="relative z-10 text-muted-foreground transition-opacity md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100"
                    onClick={() => setDeleting(artifact)}
                    aria-label={`Delete ${artifact.title}`}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
                <div className="border-t pt-3">
                  <ArtifactStatusBadge status={artifact.status} />
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      <GenerateArtifactDialog
        workspaceId={workspaceId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this study tool?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">
                {deleting?.title}
              </span>{" "}
              will be deleted for good. You can generate a new one from your
              sources, which uses credits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteArtifact.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteArtifact.isPending}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {deleteArtifact.isPending ? <Spinner /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
