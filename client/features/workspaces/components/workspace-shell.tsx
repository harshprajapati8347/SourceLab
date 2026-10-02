"use client";

import { usePathname } from "next/navigation";
import { PanelRightIcon, SearchIcon } from "lucide-react";
import { CreditsBadge } from "@/features/billing";
import { UserMenu } from "@/features/auth/components/user-menu";
import { learnRoutes } from "@/features/learn/lib/routes";
import { AddSourceDialog, SourcesPanel } from "@/features/sources";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useModKeyLabel } from "@/shared/hooks/use-keyboard-shortcuts";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { useUIStore } from "@/shared/stores/ui-store";
import { useWorkspace } from "../hooks/use-workspaces";
import { workspaceRoutes } from "../lib/routes";
import type { Workspace } from "../lib/types";
import { AppOverlays } from "./app-overlays";
import { WorkspaceHeaderActions } from "./workspace-header-actions";
import { WorkspaceSidebar } from "./workspace-sidebar";

type WorkspaceShellProps = {
  workspace: Workspace;
  children: React.ReactNode;
};

export function WorkspaceShell({
  workspace: initialWorkspace,
  children,
}: WorkspaceShellProps) {
  // Seeded from the server; renames made in settings flow in through the query cache.
  const { data: workspace = initialWorkspace } = useWorkspace(
    initialWorkspace.id,
    initialWorkspace,
  );
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const mod = useModKeyLabel();

  const addSourceOpen = useUIStore((state) => state.addSourceOpen);
  const setAddSourceOpen = useUIStore((state) => state.setAddSourceOpen);
  const sourcesPanelOpen = useUIStore((state) => state.sourcesPanelOpen);
  const toggleSourcesPanel = useUIStore((state) => state.toggleSourcesPanel);
  const sourcesSheetOpen = useUIStore((state) => state.sourcesSheetOpen);
  const setSourcesSheetOpen = useUIStore((state) => state.setSourcesSheetOpen);
  const setCommandOpen = useUIStore((state) => state.setCommandOpen);

  // The sources panel sits beside chat and learn. The library page already is the list.
  const hasSourcesPanel =
    pathname === workspaceRoutes.detail(workspace.id) ||
    pathname.startsWith(learnRoutes.hub(workspace.id));

  const panelIsOpen = isMobile ? sourcesSheetOpen : sourcesPanelOpen;

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <WorkspaceSidebar workspace={workspace} />

      <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-md sm:gap-3 sm:px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span aria-hidden="true" className="text-base leading-none">
              {workspace.icon ?? "📚"}
            </span>
            <p className="truncate font-heading text-sm font-semibold sm:text-base">
              {workspace.title}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="hidden w-44 justify-start text-muted-foreground sm:inline-flex"
            onClick={() => setCommandOpen(true)}
          >
            <SearchIcon />
            Search
            <Kbd className="ml-auto">{mod}K</Kbd>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="sm:hidden"
            onClick={() => setCommandOpen(true)}
            aria-label="Search"
          >
            <SearchIcon />
          </Button>

          <WorkspaceHeaderActions workspace={workspace} />
          <CreditsBadge className="hidden sm:inline-flex" />

          {hasSourcesPanel ? (
            <Button
              variant={panelIsOpen ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={panelIsOpen}
              aria-label="Toggle sources panel"
              onClick={() =>
                isMobile
                  ? setSourcesSheetOpen(!sourcesSheetOpen)
                  : toggleSourcesPanel()
              }
            >
              <PanelRightIcon />
              <span className="hidden md:inline">Sources</span>
            </Button>
          ) : null}

          <UserMenu />
        </header>

        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
            {children}
          </main>

          {hasSourcesPanel && sourcesPanelOpen ? (
            <aside
              aria-label="Sources"
              className="hidden w-80 shrink-0 border-l bg-card/30 duration-200 animate-in slide-in-from-right-4 fade-in md:flex md:flex-col"
            >
              <SourcesPanel
                workspaceId={workspace.id}
                onAddSource={() => setAddSourceOpen(true)}
              />
            </aside>
          ) : null}
        </div>
      </SidebarInset>

      {hasSourcesPanel ? (
        <Sheet open={isMobile && sourcesSheetOpen} onOpenChange={setSourcesSheetOpen}>
          <SheetContent side="right" className="w-[85vw] max-w-sm gap-0 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Sources</SheetTitle>
              <SheetDescription>
                The sources in this notebook.
              </SheetDescription>
            </SheetHeader>
            <SourcesPanel
              workspaceId={workspace.id}
              onAddSource={() => {
                setSourcesSheetOpen(false);
                setAddSourceOpen(true);
              }}
            />
          </SheetContent>
        </Sheet>
      ) : null}

      <AddSourceDialog
        workspaceId={workspace.id}
        open={addSourceOpen}
        onOpenChange={setAddSourceOpen}
      />
      <AppOverlays workspaceId={workspace.id} />
    </SidebarProvider>
  );
}
