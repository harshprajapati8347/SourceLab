"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BrainIcon,
  CheckIcon,
  ChevronDownIcon,
  PenLineIcon,
  SparklesIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { memoryRoutes } from "../lib/routes";

const SOURCE_LINKS = [
  {
    label: "All memories",
    source: null,
    icon: BrainIcon,
  },
  {
    label: "Added by you",
    source: "manual",
    icon: PenLineIcon,
  },
  {
    label: "Learned from chat",
    source: "learned",
    icon: SparklesIcon,
  },
] as const;

type MemorySource = "manual" | "learned" | null;

type MemoryMenuProps = {
  align?: "start" | "end";
  /**
   * Hide the word below this breakpoint so a crowded header keeps the icon.
   * The control stays named "Memory".
   */
  hideLabelBelow?: "sm" | "md";
  /** Set inside a notebook so the menu can open that notebook's memory. */
  workspaceId?: string;
};

const LABEL_VISIBILITY = {
  sm: "hidden sm:inline",
  md: "hidden md:inline",
} as const;

function MemoryMenuLinkList({
  workspaceId,
  active,
  activeSource,
}: {
  workspaceId?: string | null;
  active: boolean;
  activeSource: MemorySource;
}) {
  return (
    <>
      {SOURCE_LINKS.map((item) => {
        const Icon = item.icon;
        const href = memoryRoutes.href({
          workspaceId,
          source: item.source,
        });
        const current = active && activeSource === item.source;

        return (
          <DropdownMenuItem
            key={href}
            render={
              <Link href={href} aria-current={current ? "page" : undefined} />
            }
          >
            <Icon />
            {item.label}
            {current ? (
              <CheckIcon className="ml-auto" aria-label="Current page" />
            ) : null}
          </DropdownMenuItem>
        );
      })}
    </>
  );
}

function MemoryMenuBody({
  notebookId,
  onMemoryPage,
  activeWorkspaceId,
  activeSource,
}: {
  notebookId: string | null;
  onMemoryPage: boolean;
  activeWorkspaceId: string | null;
  activeSource: MemorySource;
}) {
  const viewingNotebook =
    onMemoryPage && notebookId !== null && activeWorkspaceId === notebookId;
  const viewingUser = onMemoryPage && !activeWorkspaceId;

  if (!notebookId) {
    return (
      <>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-medium text-foreground">
            Memory
          </DropdownMenuLabel>
          <p className="px-2 pb-1.5 text-xs text-muted-foreground">
            Recalled in every notebook.
          </p>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <MemoryMenuLinkList active={viewingUser} activeSource={activeSource} />
      </>
    );
  }

  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel className="font-medium text-foreground">
          Memory
        </DropdownMenuLabel>
        <p className="px-2 pb-1.5 text-xs text-muted-foreground">
          Notebook memories stay in this notebook.
        </p>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>This notebook</DropdownMenuLabel>
        <MemoryMenuLinkList
          workspaceId={notebookId}
          active={viewingNotebook}
          activeSource={activeSource}
        />
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        render={
          <Link
            href={memoryRoutes.settings}
            aria-current={viewingUser ? "page" : undefined}
          />
        }
      >
        <BrainIcon />
        Your memory
        {viewingUser ? (
          <CheckIcon className="ml-auto" aria-label="Current page" />
        ) : null}
      </DropdownMenuItem>
    </>
  );
}

/** Reads the source filter and notebook id. Kept behind Suspense so the page can prerender. */
function MemoryMenuLinks({
  onMemoryPage,
  workspaceId,
}: {
  onMemoryPage: boolean;
  workspaceId?: string;
}) {
  const searchParams = useSearchParams();
  const sourceParam = searchParams.get("source");
  const activeSource =
    sourceParam === "manual" || sourceParam === "learned" ? sourceParam : null;
  const queryWorkspaceId = searchParams.get("workspaceId")?.trim() || null;
  const activeWorkspaceId = onMemoryPage ? queryWorkspaceId : null;
  const notebookId = workspaceId?.trim() || activeWorkspaceId;

  return (
    <MemoryMenuBody
      notebookId={notebookId}
      onMemoryPage={onMemoryPage}
      activeWorkspaceId={activeWorkspaceId}
      activeSource={activeSource}
    />
  );
}

/** Top-bar menu for user memory and, inside a notebook, that notebook's memory. */
export function MemoryMenu({
  align = "end",
  hideLabelBelow,
  workspaceId,
}: MemoryMenuProps) {
  const pathname = usePathname();
  const onMemoryPage = pathname === memoryRoutes.settings;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant={onMemoryPage ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "shrink-0",
              hideLabelBelow === "sm" && "max-sm:px-2",
              hideLabelBelow === "md" && "max-md:px-2",
            )}
            aria-label="Memory"
          />
        }
      >
        <BrainIcon />
        <span
          className={hideLabelBelow ? LABEL_VISIBILITY[hideLabelBelow] : undefined}
        >
          Memory
        </span>
        <ChevronDownIcon
          className={cn(
            "size-3 text-muted-foreground",
            hideLabelBelow && LABEL_VISIBILITY[hideLabelBelow],
          )}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-64">
        <Suspense
          fallback={
            <MemoryMenuBody
              notebookId={workspaceId?.trim() || null}
              onMemoryPage={false}
              activeWorkspaceId={null}
              activeSource={null}
            />
          }
        >
          <MemoryMenuLinks
            onMemoryPage={onMemoryPage}
            workspaceId={workspaceId}
          />
        </Suspense>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
