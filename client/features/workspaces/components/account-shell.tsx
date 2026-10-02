"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/shared/components/page-header";
import { workspaceRoutes } from "../lib/routes";
import { AppHeader } from "./app-header";
import { AppOverlays } from "./app-overlays";

type AccountShellProps = {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

/** Frame for account-level pages (billing, memory): app header, back link, title, content. */
export function AccountShell({
  title,
  description,
  actions,
  children,
}: AccountShellProps) {
  return (
    <div className="min-h-svh bg-background">
      <AppHeader innerClassName="max-w-3xl md:px-6" />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 md:px-6 md:py-10">
        <Button
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit text-muted-foreground"
          render={<Link href={workspaceRoutes.list} />}
        >
          <ArrowLeftIcon />
          All notebooks
        </Button>
        <PageHeader title={title} description={description} actions={actions} />
        {children}
      </main>
      <AppOverlays />
    </div>
  );
}
