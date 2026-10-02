"use client";

import { ShortcutsDialog } from "@/shared/components/shortcuts-dialog";
import { useKeyboardShortcuts } from "@/shared/hooks/use-keyboard-shortcuts";
import { useUIStore } from "@/shared/stores/ui-store";
import { CommandPalette } from "./command-palette";

type AppOverlaysProps = {
  workspaceId?: string;
};

/**
 * Mounts the command palette and shortcuts dialog and registers the global
 * shortcuts. Render it once per page shell.
 */
export function AppOverlays({ workspaceId }: AppOverlaysProps) {
  const setCommandOpen = useUIStore((state) => state.setCommandOpen);
  const setShortcutsOpen = useUIStore((state) => state.setShortcutsOpen);
  const setAddSourceOpen = useUIStore((state) => state.setAddSourceOpen);
  const toggleSourcesPanel = useUIStore((state) => state.toggleSourcesPanel);

  useKeyboardShortcuts({
    onCommand: () => setCommandOpen(true),
    onShortcuts: () => setShortcutsOpen(true),
    onFocusChat: workspaceId
      ? () => {
          document
            .querySelector<HTMLTextAreaElement>("[data-chat-input]")
            ?.focus();
        }
      : undefined,
    onAddSource: workspaceId ? () => setAddSourceOpen(true) : undefined,
    onToggleSources: workspaceId ? toggleSourcesPanel : undefined,
  });

  return (
    <>
      <CommandPalette workspaceId={workspaceId} />
      <ShortcutsDialog />
    </>
  );
}
