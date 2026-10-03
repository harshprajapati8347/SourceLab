"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/shared/lib/navigation-progress";

/**
 * Next.js app router whose `push` and `replace` start the top progress bar
 * when the destination pathname changes.
 */
export function useAppRouter() {
  const router = useRouter();

  return useMemo(
    () => ({
      ...router,
      push(href: string, options?: Parameters<typeof router.push>[1]) {
        startNavigationProgress(href);
        router.push(href, options);
      },
      replace(href: string, options?: Parameters<typeof router.replace>[1]) {
        startNavigationProgress(href);
        router.replace(href, options);
      },
    }),
    [router],
  );
}
