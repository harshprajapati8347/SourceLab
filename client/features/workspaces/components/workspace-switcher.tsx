"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusIcon, SearchIcon } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { useUIStore } from "@/shared/stores/ui-store";
import { useWorkspaces } from "../hooks/use-workspaces";
import { workspaceRoutes } from "../lib/routes";

type WorkspaceSwitcherProps = {
  activeWorkspaceId: string;
};

/** Searchable list of the user's notebooks, shown in the workspace sidebar. */
export function WorkspaceSwitcher({
  activeWorkspaceId,
}: WorkspaceSwitcherProps) {
  const router = useRouter();
  const { data: workspaces, isLoading, error } = useWorkspaces();
  const setCreateWorkspaceOpen = useUIStore(
    (state) => state.setCreateWorkspaceOpen,
  );
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!workspaces) {
      return [];
    }
    if (!needle) {
      return workspaces;
    }
    return workspaces.filter((workspace) =>
      workspace.title.toLowerCase().includes(needle),
    );
  }, [workspaces, query]);

  return (
    <SidebarGroup className="min-h-0 flex-1">
      <SidebarGroupLabel>Notebooks</SidebarGroupLabel>
      <SidebarGroupAction
        title="New notebook"
        onClick={() => {
          setCreateWorkspaceOpen(true);
          router.push(workspaceRoutes.list);
        }}
      >
        <PlusIcon />
        <span className="sr-only">New notebook</span>
      </SidebarGroupAction>

      <SidebarGroupContent className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="relative px-2">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a notebook"
            aria-label="Find a notebook"
            className="h-8 w-full rounded-md border border-sidebar-border bg-sidebar-accent/40 pr-2 pl-8 text-sm text-sidebar-foreground outline-none transition-colors duration-200 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col gap-2 px-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <SidebarMenuSkeleton key={index} showIcon />
              ))}
            </div>
          ) : error ? (
            <p className="px-3 py-2 text-xs text-destructive">
              Could not load your notebooks.
            </p>
          ) : visible.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {query ? "No notebook matches that name." : "No notebooks yet."}
            </p>
          ) : (
            <SidebarMenu>
              {visible.map((workspace) => (
                <SidebarMenuItem key={workspace.id}>
                  <SidebarMenuButton
                    isActive={workspace.id === activeWorkspaceId}
                    render={<Link href={workspaceRoutes.detail(workspace.id)} />}
                  >
                    <span aria-hidden="true" className="w-4 text-center text-sm leading-none">
                      {workspace.icon ?? "📚"}
                    </span>
                    <span className="truncate">{workspace.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          )}
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
