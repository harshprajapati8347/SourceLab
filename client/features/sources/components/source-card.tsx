"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { MoreHorizontalIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { SOURCE_TYPE_LABELS } from "../lib/constants";
import { sourceRoutes } from "../lib/routes";
import type { Source } from "../lib/types";
import { SourceStatusBadge } from "./source-status-badge";
import { SourceTypeIcon } from "./source-type-icon";

type SourceCardProps = {
  source: Source;
  layout?: "grid" | "list";
  onDelete?: (source: Source) => void;
  onReprocess?: (source: Source) => void;
  className?: string;
};

export function SourceCard({
  source,
  layout = "grid",
  onDelete,
  onReprocess,
  className,
}: SourceCardProps) {
  const isList = layout === "list";
  const preview = source.content?.replace(/\s+/g, " ").trim().slice(0, 220);

  return (
    <article
      className={cn(
        "group relative flex w-full min-w-0 overflow-hidden rounded-xl border bg-card p-4 transition-colors duration-200 ease-house focus-within:border-primary/40 hover:border-primary/40",
        isList ? "items-center gap-4" : "flex-col gap-3",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground",
            source.status === "FAILED" &&
              "border-destructive/30 bg-destructive/10 text-destructive",
          )}
        >
          <SourceTypeIcon type={source.type} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">
            <Link
              href={sourceRoutes.detail(source.workspaceId, source.id)}
              className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-ring/40"
            >
              {source.title}
            </Link>
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {SOURCE_TYPE_LABELS[source.type]} · Added{" "}
            {formatDistanceToNow(new Date(source.createdAt), {
              addSuffix: true,
            })}
          </p>
          {!isList && preview ? (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed wrap-break-word text-muted-foreground">
              {preview}
            </p>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "flex items-center gap-2",
          isList ? "shrink-0" : "justify-between border-t pt-3",
        )}
      >
        <SourceStatusBadge status={source.status} />

        {onDelete || onReprocess ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="relative z-10 shrink-0 text-muted-foreground"
                  aria-label={`Actions for ${source.title}`}
                />
              }
            >
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {onReprocess ? (
                <DropdownMenuItem onClick={() => onReprocess(source)}>
                  <RefreshCwIcon />
                  Reprocess
                </DropdownMenuItem>
              ) : null}
              {onDelete ? (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDelete(source)}
                >
                  <Trash2Icon />
                  Delete
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </article>
  );
}
