"use client";

import Link from "next/link";
import { AlertCircleIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { sourceRoutes } from "@/features/sources/lib/routes";
import type { Source } from "@/features/sources/lib/types";

type SourceStatusBannerProps = {
  workspaceId: string;
  sources: Source[] | undefined;
};

function plural(count: number) {
  return count === 1 ? "1 source" : `${count} sources`;
}

/**
 * Tells the user when sources are still indexing or failed. It never blocks
 * the composer: chat works with whatever is already indexed.
 */
export function SourceStatusBanner({
  workspaceId,
  sources,
}: SourceStatusBannerProps) {
  if (!sources) {
    return null;
  }

  const working = sources.filter(
    (source) => source.status === "PENDING" || source.status === "PROCESSING",
  ).length;
  const failed = sources.filter((source) => source.status === "FAILED").length;

  if (working === 0 && failed === 0) {
    return null;
  }

  return (
    <div
      role="status"
      className="flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t bg-muted/40 px-4 py-2 text-xs text-muted-foreground"
    >
      {working > 0 ? (
        <span className="flex items-center gap-1.5">
          <Spinner className="size-3" />
          Indexing {plural(working)}. Answers will not cover{" "}
          {working === 1 ? "it" : "them"} yet.
        </span>
      ) : null}
      {failed > 0 ? (
        <span className="flex items-center gap-1.5 text-destructive">
          <AlertCircleIcon className="size-3.5" aria-hidden="true" />
          {plural(failed)} failed to process.
          <Link
            href={sourceRoutes.list(workspaceId)}
            className="font-medium underline underline-offset-4"
          >
            Review in the library
          </Link>
        </span>
      ) : null}
    </div>
  );
}
