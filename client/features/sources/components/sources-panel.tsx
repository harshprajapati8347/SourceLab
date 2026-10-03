"use client";

import Link from "next/link";
import { AlertCircleIcon, ArrowUpRightIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  dismissMobileSidebarsOnAnchorClick,
  useDismissMobileSidebars,
} from "@/shared/hooks/use-dismiss-mobile-sidebars";
import { useSources } from "../hooks/use-sources";
import { SOURCE_TYPE_LABELS } from "../lib/constants";
import { sourceRoutes } from "../lib/routes";
import type { Source } from "../lib/types";
import { SourceTypeIcon } from "./source-type-icon";

type SourcesPanelProps = {
  workspaceId: string;
  onAddSource: () => void;
  className?: string;
};

function SourceRow({
  source,
  workspaceId,
}: {
  source: Source;
  workspaceId: string;
}) {
  const isWorking =
    source.status === "PENDING" || source.status === "PROCESSING";
  const isFailed = source.status === "FAILED";

  return (
    <li>
      <Link
        href={sourceRoutes.detail(workspaceId, source.id)}
        className="group flex items-center gap-3 rounded-lg border border-transparent p-2 outline-none transition-colors duration-200 hover:border-border hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground",
            isFailed && "border-destructive/30 bg-destructive/10 text-destructive",
          )}
        >
          <SourceTypeIcon type={source.type} className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {source.title}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {isWorking ? (
              <>
                <Spinner className="size-3" />
                Indexing
              </>
            ) : isFailed ? (
              <>
                <AlertCircleIcon className="size-3 text-destructive" />
                <span className="text-destructive">Failed</span>
              </>
            ) : (
              SOURCE_TYPE_LABELS[source.type]
            )}
          </span>
        </span>
        <ArrowUpRightIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100" />
      </Link>
    </li>
  );
}

/** The notebook's sources, as a compact list beside chat and learn. */
export function SourcesPanel({
  workspaceId,
  onAddSource,
  className,
}: SourcesPanelProps) {
  const dismissMobileSidebars = useDismissMobileSidebars();
  const { data: sources, isLoading, error } = useSources(workspaceId);

  function addSource() {
    dismissMobileSidebars();
    onAddSource();
  }

  return (
    <div
      className={cn("flex h-full min-h-0 flex-col", className)}
      onClick={(event) =>
        dismissMobileSidebarsOnAnchorClick(event, dismissMobileSidebars)
      }
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
        <h2 className="font-heading text-sm font-semibold">
          Sources
          {sources ? (
            <span className="ml-1.5 font-normal text-muted-foreground">
              {sources.length}
            </span>
          ) : null}
        </h2>
        <Button className="mr-8 md:mr-0" size="sm" variant="outline" onClick={addSource}>
          <PlusIcon />
          Add
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="grid gap-2" aria-busy="true">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            Could not load sources. Refresh to try again.
          </p>
        ) : sources && sources.length > 0 ? (
          <ul className="grid gap-0.5">
            {sources.map((source) => (
              <SourceRow
                key={source.id}
                source={source}
                workspaceId={workspaceId}
              />
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <p className="text-sm font-medium">No sources yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add a PDF, a web page, a YouTube video, or paste text. Answers
              will cite what you add here.
            </p>
            <Button className="mt-4" size="sm" onClick={addSource}>
              <PlusIcon />
              Add a source
            </Button>
          </div>
        )}
      </div>

      {sources && sources.length > 0 ? (
        <div className="shrink-0 border-t p-2">
          <Button
            nativeButton={false}
            variant="ghost"
            size="sm"
            className="w-full justify-between"
            render={<Link href={sourceRoutes.list(workspaceId)} />}
          >
            Open the source library
            <ArrowUpRightIcon />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
