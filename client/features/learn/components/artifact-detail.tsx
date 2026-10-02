"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { ApiError } from "@/shared/lib/api";
import { ARTIFACT_TYPE_LABELS } from "../lib/constants";
import { learnRoutes } from "../lib/routes";
import { useArtifact } from "../hooks/use-artifacts";
import { ArtifactContentViewer } from "./artifact-content-viewer";
import { ArtifactStatusBadge } from "./artifact-status-badge";
import { ArtifactTypeIcon } from "./artifact-type-icon";

type ArtifactDetailProps = {
  workspaceId: string;
  artifactId: string;
};

const CENTERED =
  "mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-3 p-6 text-center";

export function ArtifactDetail({
  workspaceId,
  artifactId,
}: ArtifactDetailProps) {
  const {
    data: artifact,
    isLoading,
    error,
    refetch,
  } = useArtifact(workspaceId, artifactId);

  if (isLoading) {
    return (
      <div
        className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4 md:p-8"
        aria-busy="true"
        aria-label="Loading study tool"
      >
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className={CENTERED}>
        <h1 className="font-heading text-lg font-semibold">
          This study tool no longer exists
        </h1>
        <p className="text-sm text-muted-foreground">
          It may have been deleted.
        </p>
        <Button
          nativeButton={false}
          variant="outline"
          render={<Link href={learnRoutes.hub(workspaceId)} />}
        >
          <ArrowLeftIcon />
          Back to Learn
        </Button>
      </div>
    );
  }

  if (error || !artifact) {
    return (
      <div className={CENTERED}>
        <h1 className="font-heading text-lg font-semibold">
          Could not load this study tool
        </h1>
        <p className="text-sm text-muted-foreground">
          Check your connection and try again.
        </p>
        <Button variant="outline" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const processingError =
    typeof artifact.metadata?.processingError === "string"
      ? artifact.metadata.processingError
      : null;
  const isMindMap = artifact.type === "MINDMAP";
  const isProcessing =
    artifact.status === "PENDING" || artifact.status === "PROCESSING";

  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-1 flex-col",
        isMindMap
          ? "min-h-0 max-w-none gap-4 p-3 md:p-4"
          : "max-w-4xl gap-6 p-4 md:p-8",
      )}
    >
      <div className="flex items-start gap-3">
        <Button
          nativeButton={false}
          variant="ghost"
          size="icon-sm"
          className="mt-0.5"
          aria-label="Back to Learn"
          render={<Link href={learnRoutes.hub(workspaceId)} />}
        >
          <ArrowLeftIcon />
        </Button>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <ArtifactTypeIcon
              type={artifact.type}
              className="text-muted-foreground"
            />
            <h1 className="font-heading text-xl font-bold tracking-tight">
              {artifact.title}
            </h1>
            <ArtifactStatusBadge status={artifact.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {ARTIFACT_TYPE_LABELS[artifact.type]} · Generated{" "}
            {formatDistanceToNow(new Date(artifact.createdAt), {
              addSuffix: true,
            })}
          </p>
        </div>
      </div>

      {isProcessing ? (
        <div
          role="status"
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-sm text-muted-foreground"
        >
          <Spinner className="size-4" />
          Generating your {ARTIFACT_TYPE_LABELS[artifact.type].toLowerCase()}.
          This page updates when it is ready.
        </div>
      ) : artifact.status === "FAILED" ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
          <p className="font-medium text-destructive">Generation failed</p>
          {processingError ? (
            <p className="mt-2 text-muted-foreground">{processingError}</p>
          ) : null}
          <p className="mt-2 text-muted-foreground">
            Go back to Learn and generate it again.
          </p>
        </div>
      ) : isMindMap ? (
        <div className="min-h-0 flex-1">
          <ArtifactContentViewer
            artifact={artifact}
            workspaceId={workspaceId}
          />
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-4 md:p-6">
          <ArtifactContentViewer
            artifact={artifact}
            workspaceId={workspaceId}
          />
        </div>
      )}
    </div>
  );
}
