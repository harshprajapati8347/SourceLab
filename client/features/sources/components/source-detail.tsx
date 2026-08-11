"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/shared/lib/api";
import { useSource } from "../hooks/use-sources";
import { SOURCE_TYPE_LABELS } from "../lib/constants";
import { sourceRoutes } from "../lib/routes";
import { MarkdownPreview } from "./markdown-preview";
import { SourceStatusBadge } from "./source-status-badge";
import { SourceTypeIcon } from "./source-type-icon";

type SourceDetailProps = {
  workspaceId: string;
  sourceId: string;
};

export function SourceDetail({ workspaceId, sourceId }: SourceDetailProps) {
  const { data: source, isLoading, error } = useSource(workspaceId, sourceId);

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-medium">Source not found</p>
        <Button
          nativeButton={false}
          variant="outline"
          render={<Link href={sourceRoutes.list(workspaceId)} />}
        >
          Back to library
        </Button>
      </div>
    );
  }

  if (error || !source) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-medium">Could not load source</p>
      </div>
    );
  }

  const metadata = source.metadata ?? {};
  const fileUrl =
    typeof metadata.fileUrl === "string" ? metadata.fileUrl : null;
  const fileName =
    typeof metadata.fileName === "string" ? metadata.fileName : null;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-start gap-3">
        <Button
          nativeButton={false}
          variant="ghost"
          size="icon-sm"
          render={<Link href={sourceRoutes.list(workspaceId)} />}
        >
          <ArrowLeftIcon />
        </Button>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <SourceTypeIcon type={source.type} />
            <h2 className="font-heading text-xl font-semibold">
              {source.title}
            </h2>
            <SourceStatusBadge status={source.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {SOURCE_TYPE_LABELS[source.type]} · Added{" "}
            {formatDistanceToNow(new Date(source.createdAt), {
              addSuffix: true,
            })}
          </p>
        </div>
      </div>

      {source.url ? (
        <div className="flex items-center gap-2 text-sm">
          <ExternalLinkIcon className="size-4" />
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="truncate text-primary underline-offset-4 hover:underline"
          >
            {source.url}
          </a>
        </div>
      ) : null}

      {source.type === "PDF" && fileUrl ? (
        <div className="rounded-2xl border bg-muted/30 p-4 text-sm">
          <p className="font-medium">PDF uploaded</p>
          {fileName ? (
            <p className="text-muted-foreground">{fileName}</p>
          ) : null}
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex text-primary underline-offset-4 hover:underline"
          >
            Open PDF
          </a>
        </div>
      ) : null}

      {source.content ? (
        source.type === "MARKDOWN" ? (
          <MarkdownPreview content={source.content} />
        ) : (
          <div className="rounded-2xl border bg-muted/30 p-4">
            <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap font-mono text-sm leading-relaxed">
              {source.content}
            </pre>
          </div>
        )
      ) : (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No extracted content yet. Processing will run in the next phase.
        </div>
      )}
    </div>
  );
}
