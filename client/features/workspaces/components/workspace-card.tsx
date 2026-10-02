"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowUpRightIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { workspaceRoutes } from "../lib/routes";
import type { Workspace } from "../lib/types";

type WorkspaceCardProps = {
  workspace: Workspace;
  onEdit: (workspace: Workspace) => void;
  onDelete: (workspace: Workspace) => void;
  className?: string;
};

export function WorkspaceCard({
  workspace,
  onEdit,
  onDelete,
  className,
}: WorkspaceCardProps) {
  return (
    <article
      className={cn(
        "group relative flex min-h-44 flex-col rounded-xl border bg-card p-4 transition-[border-color,background-color] duration-200 ease-house hover:border-primary/40 hover:bg-card focus-within:border-primary/40",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-lg border bg-muted text-xl"
        >
          {workspace.icon ?? "📚"}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="relative z-10 text-muted-foreground transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100 data-popup-open:opacity-100"
                aria-label={`Actions for ${workspace.title}`}
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onEdit(workspace)}>
              <PencilIcon />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDelete(workspace)}
            >
              <Trash2Icon />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4 min-w-0 flex-1">
        <h3 className="line-clamp-1 font-heading text-base font-semibold">
          <Link
            href={workspaceRoutes.detail(workspace.id)}
            className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-ring/40"
          >
            {workspace.title}
          </Link>
        </h3>
        {workspace.description ? (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {workspace.description}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground/70">
            No description yet.
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <span>
          Updated{" "}
          {formatDistanceToNow(new Date(workspace.updatedAt), {
            addSuffix: true,
          })}
        </span>
        <ArrowUpRightIcon
          aria-hidden="true"
          className="size-3.5 transition-all duration-200 ease-house group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary-ink"
        />
      </div>
    </article>
  );
}
