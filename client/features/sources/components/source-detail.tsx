"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeftIcon, ExternalLinkIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/shared/lib/api";
import { useReprocessSource, useSource } from "../hooks/use-sources";
import { SOURCE_TYPE_LABELS } from "../lib/constants";
import { sourceRoutes } from "../lib/routes";
import { MarkdownPreview } from "./markdown-preview";
import { SourceStatusBadge } from "./source-status-badge";
import { SourceTypeIcon } from "./source-type-icon";

type SourceDetailProps = {
  workspaceId: string;
  sourceId: string;
};

const PAGE = "mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 md:p-8";

export function SourceDetail({ workspaceId, sourceId }: SourceDetailProps) {
  const { data: source, isLoading, error, refetch } = useSource(
    workspaceId,
    sourceId,
  );
  const reprocess = useReprocessSource(workspaceId);

  if (isLoading) {
    return (
      <div className={PAGE} aria-busy="true" aria-label="Loading source">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className={`${PAGE} items-center justify-center text-center`}>
        <h1 className="font-heading text-lg font-semibold">
          This source no longer exists
        </h1>
        <p className="text-sm text-muted-foreground">
          It may have been deleted. Go back to see what is left.
        </p>
        <Button
          nativeButton={false}
          variant="outline"
          render={<Link href={sourceRoutes.list(workspaceId)} />}
        >
          <ArrowLeftIcon />
          Back to sources
        </Button>
      </div>
    );
  }

  if (error || !source) {
    return (
      <div className={`${PAGE} items-center justify-center text-center`}>
        <h1 className="font-heading text-lg font-semibold">
          Could not load this source
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

  const metadata = source.metadata ?? {};
  const fileUrl =
    typeof metadata.fileUrl === "string" ? metadata.fileUrl : null;
  const fileName =
    typeof metadata.fileName === "string" ? metadata.fileName : null;
  const chunkCount =
    typeof metadata.chunkCount === "number" ? metadata.chunkCount : null;
  const processingError =
    typeof metadata.processingError === "string"
      ? metadata.processingError
      : null;
  const isProcessing =
    source.status === "PENDING" || source.status === "PROCESSING";

  return (
    <div className={PAGE}>
      <div className="flex items-start gap-3">
        <Button
          nativeButton={false}
          variant="ghost"
          size="icon-sm"
          className="mt-0.5"
          aria-label="Back to sources"
          render={<Link href={sourceRoutes.list(workspaceId)} />}
        >
          <ArrowLeftIcon />
        </Button>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <SourceTypeIcon type={source.type} className="text-muted-foreground" />
            <h1 className="font-heading text-xl font-bold tracking-tight">
              {source.title}
            </h1>
            <SourceStatusBadge status={source.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {SOURCE_TYPE_LABELS[source.type]} · Added{" "}
            {formatDistanceToNow(new Date(source.createdAt), {
              addSuffix: true,
            })}
            {chunkCount != null ? ` · ${chunkCount} passages indexed` : null}
          </p>
        </div>
      </div>

      {source.url ? (
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="group inline-flex w-fit max-w-full items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm outline-none transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <ExternalLinkIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{source.url}</span>
        </a>
      ) : null}

      {source.type === "PDF" && fileUrl ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 text-sm">
          <div className="min-w-0">
            <p className="font-medium">PDF uploaded</p>
            {fileName ? (
              <p className="truncate text-muted-foreground">{fileName}</p>
            ) : null}
          </div>
          <Button
            nativeButton={false}
            variant="outline"
            size="sm"
            render={<a href={fileUrl} target="_blank" rel="noreferrer" />}
          >
            <ExternalLinkIcon />
            Open PDF
          </Button>
        </div>
      ) : null}

      {isProcessing ? (
        <div
          role="status"
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-sm text-muted-foreground"
        >
          <Spinner className="size-4" />
          Extracting text and indexing this source. This page updates when it
          is done.
        </div>
      ) : source.status === "FAILED" ? (
        <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
          <p className="font-medium text-destructive">Processing failed</p>
          {processingError ? (
            <p className="text-muted-foreground">{processingError}</p>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            disabled={reprocess.isPending}
            onClick={() => reprocess.mutate(source.id)}
          >
            {reprocess.isPending ? <Spinner /> : <RefreshCwIcon />}
            Try again
          </Button>
        </div>
      ) : source.content ? (
        <MarkdownPreview content={source.content} />
      ) : (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No extracted text is available for this source.
        </div>
      )}
    </div>
  );
}
