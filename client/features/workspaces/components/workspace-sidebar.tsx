"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GraduationCapIcon,
  LayoutGridIcon,
  LibraryIcon,
  MessageSquareIcon,
  SettingsIcon,
} from "lucide-react";
import { learnRoutes } from "@/features/learn/lib/routes";
import { sourceRoutes } from "@/features/sources/lib/routes";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { BrandMark } from "@/shared/components/brand-mark";
import {
  dismissMobileSidebarsOnAnchorClick,
  useDismissMobileSidebars,
} from "@/shared/hooks/use-dismiss-mobile-sidebars";
import { workspaceRoutes } from "../lib/routes";
import type { Workspace } from "../lib/types";
import { WorkspaceSwitcher } from "./workspace-switcher";

type WorkspaceSidebarProps = {
  workspace: Workspace;
};

export function WorkspaceSidebar({ workspace }: WorkspaceSidebarProps) {
  const pathname = usePathname();
  const dismissMobileSidebars = useDismissMobileSidebars();

  const chatPath = workspaceRoutes.detail(workspace.id);
  const learnPath = learnRoutes.hub(workspace.id);
  const sourcesPath = sourceRoutes.list(workspace.id);
  const settingsPath = workspaceRoutes.settings(workspace.id);

  const items = [
    {
      label: "Chat",
      href: chatPath,
      icon: MessageSquareIcon,
      active:
        pathname === chatPath,
    },
    {
      label: "Learn",
      href: learnPath,
      icon: GraduationCapIcon,
      active: pathname.startsWith(learnPath),
    },
    {
      label: "Sources",
      href: sourcesPath,
      icon: LibraryIcon,
      active: pathname.startsWith(sourcesPath),
    },
    {
      label: "Settings",
      href: settingsPath,
      icon: SettingsIcon,
      active: pathname.startsWith(settingsPath),
    },
  ];

  return (
    <Sidebar>
      <div
        className="flex h-full min-h-0 w-full flex-1 flex-col"
        onClick={(event) =>
          dismissMobileSidebarsOnAnchorClick(event, dismissMobileSidebars)
        }
      >
        <SidebarHeader className="h-14 justify-center border-b border-sidebar-border px-4 py-0">
          <Link
            href={workspaceRoutes.list}
            aria-label="SourceLab, all notebooks"
            className="w-fit rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <BrandMark />
          </Link>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="gap-2">
              <span aria-hidden="true" className="text-sm leading-none">
                {workspace.icon ?? "📚"}
              </span>
              <span className="truncate">{workspace.title}</span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      isActive={item.active}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <WorkspaceSwitcher activeWorkspaceId={workspace.id} />
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton render={<Link href={workspaceRoutes.list} />}>
                <LayoutGridIcon />
                <span>All notebooks</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </div>

      <SidebarRail />
    </Sidebar>
  );
}
