"use client";

import * as React from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { useUIStore } from "@/shared/stores/ui-store";

/**
 * Closes the mobile left sidebar and the mobile sources sheet.
 * No-op at desktop width. Does not change the desktop sidebar or the persisted sources panel.
 * Must be called under `SidebarProvider`.
 */
export function useDismissMobileSidebars() {
  const { isMobile, setOpenMobile } = useSidebar();
  const setSourcesSheetOpen = useUIStore((state) => state.setSourcesSheetOpen);

  return React.useCallback(() => {
    if (!isMobile) {
      return;
    }
    setOpenMobile(false);
    setSourcesSheetOpen(false);
  }, [isMobile, setOpenMobile, setSourcesSheetOpen]);
}

/**
 * Dismisses mobile sidebars for an unmodified primary click on a link.
 * Does not cancel navigation. Ignores `defaultPrevented` because Next.js Link
 * calls `preventDefault` on the anchor before this parent handler runs.
 */
export function dismissMobileSidebarsOnAnchorClick(
  event: React.MouseEvent,
  dismiss: () => void,
) {
  if (event.button !== 0) {
    return;
  }
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }

  const target = event.target;
  const element =
    target instanceof Element
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;

  if (!element?.closest("a")) {
    return;
  }

  dismiss();
}
