"use client";

import Link from "next/link";
import { SearchIcon } from "lucide-react";
import { UserMenu } from "@/features/auth/components/user-menu";
import { CreditsBadge } from "@/features/billing/components/credits-badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/shared/components/brand-mark";
import { useModKeyLabel } from "@/shared/hooks/use-keyboard-shortcuts";
import { useUIStore } from "@/shared/stores/ui-store";
import { workspaceRoutes } from "../lib/routes";

type AppHeaderProps = {
  /** Width of the inner row, to line up with the page below it. */
  innerClassName?: string;
};

/** Top bar for pages outside a notebook: dashboard, billing, memory. */
export function AppHeader({ innerClassName }: AppHeaderProps) {
  const mod = useModKeyLabel();
  const setCommandOpen = useUIStore((state) => state.setCommandOpen);

  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md">
      <div
        className={cn(
          "mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 md:px-8",
          innerClassName,
        )}
      >
        <Link
          href={workspaceRoutes.list}
          aria-label="SourceLab, all notebooks"
          className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <BrandMark />
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="hidden w-48 justify-start text-muted-foreground sm:inline-flex"
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
            aria-label="Search"
            onClick={() => setCommandOpen(true)}
          >
            <SearchIcon />
          </Button>
          <CreditsBadge className="hidden sm:inline-flex" />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
