"use client";

import { PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type CreateWorkspaceCardProps = {
  onClick: () => void;
  className?: string;
};

export function CreateWorkspaceCard({
  onClick,
  className,
}: CreateWorkspaceCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex min-h-44 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-transparent p-6 text-center outline-none transition-[border-color,background-color] duration-200 ease-house hover:border-primary/50 hover:bg-primary/5 focus-visible:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/30",
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary-ink transition-colors group-hover:bg-primary/25">
        <PlusIcon className="size-5" />
      </span>
      <span className="space-y-1">
        <span className="block text-sm font-semibold">New notebook</span>
        <span className="block text-xs text-muted-foreground">
          Add sources, then ask questions
        </span>
      </span>
    </button>
  );
}
