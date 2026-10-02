"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type UIState = {
  /** Cmd/Ctrl+K command palette. */
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  /** `?` keyboard-shortcuts dialog. */
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
  /** Create-notebook dialog, openable from the palette and the dashboard. */
  createWorkspaceOpen: boolean;
  setCreateWorkspaceOpen: (open: boolean) => void;
  /** Add-source dialog, openable from the header, the palette and the sources panel. */
  addSourceOpen: boolean;
  setAddSourceOpen: (open: boolean) => void;
  /** Right-hand sources panel on desktop (persisted) and its sheet on mobile. */
  sourcesPanelOpen: boolean;
  setSourcesPanelOpen: (open: boolean) => void;
  toggleSourcesPanel: () => void;
  sourcesSheetOpen: boolean;
  setSourcesSheetOpen: (open: boolean) => void;
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      commandOpen: false,
      setCommandOpen: (commandOpen) => set({ commandOpen }),
      shortcutsOpen: false,
      setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
      createWorkspaceOpen: false,
      setCreateWorkspaceOpen: (createWorkspaceOpen) =>
        set({ createWorkspaceOpen }),
      addSourceOpen: false,
      setAddSourceOpen: (addSourceOpen) => set({ addSourceOpen }),
      sourcesPanelOpen: true,
      setSourcesPanelOpen: (sourcesPanelOpen) => set({ sourcesPanelOpen }),
      toggleSourcesPanel: () =>
        set((state) => ({ sourcesPanelOpen: !state.sourcesPanelOpen })),
      sourcesSheetOpen: false,
      setSourcesSheetOpen: (sourcesSheetOpen) => set({ sourcesSheetOpen }),
    }),
    {
      name: "sourcelab-ui",
      partialize: (state) => ({ sourcesPanelOpen: state.sourcesPanelOpen }),
    },
  ),
);
