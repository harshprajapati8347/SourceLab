"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { authRoutes } from "@/features/auth/lib/auth-routes";
import { useSession } from "@/features/auth/hooks/use-session";
import { BrandMark } from "@/shared/components/brand-mark";
import { GitHubRepoLink } from "@/shared/components/github-repo-link";

/** Slim header for public pages outside the landing nav and the signed-in app. */
export function PublicHeader() {
  const { data: session } = useSession();

  return (
    <header className="border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 md:px-8">
        <Link
          href={authRoutes.home}
          aria-label="SourceLab home"
          className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <BrandMark />
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <GitHubRepoLink />
          <Button
            nativeButton={false}
            variant="outline"
            size="sm"
            render={
              <Link
                href={session?.user ? authRoutes.dashboard : authRoutes.login}
              />
            }
          >
            {session?.user ? "Go to dashboard" : "Sign in"}
          </Button>
        </div>
      </div>
    </header>
  );
}
