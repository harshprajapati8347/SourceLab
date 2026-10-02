"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const CHAT_MODELS = ["gpt-4o-mini", "gpt-4o"] as const;
export type ChatModelId = (typeof CHAT_MODELS)[number];

export const CHAT_MODEL_LABELS: Record<ChatModelId, string> = {
  "gpt-4o-mini": "GPT-4o mini",
  "gpt-4o": "GPT-4o",
};

type WorkspaceChatPrefs = {
  model: ChatModelId;
  webSearch: boolean;
};

/**
 * Reads one notebook's prefs from the store slice.
 *
 * Select `byWorkspace` in components. `getPrefs` is a stable function, so a
 * component that only selects it does not re-render when the toggle changes.
 */
export function readWorkspaceChatPrefs(
  byWorkspace: Record<string, WorkspaceChatPrefs>,
  workspaceId: string,
  defaultModel?: string,
): WorkspaceChatPrefs {
  return (
    byWorkspace[workspaceId] ?? {
      model: resolveModel(defaultModel),
      webSearch: false,
    }
  );
}

type ChatPreferencesState = {
  byWorkspace: Record<string, WorkspaceChatPrefs>;
  getPrefs: (workspaceId: string, defaultModel?: string) => WorkspaceChatPrefs;
  setModel: (workspaceId: string, model: ChatModelId) => void;
  setWebSearch: (workspaceId: string, enabled: boolean) => void;
};

function resolveModel(model?: string): ChatModelId {
  if (model && CHAT_MODELS.includes(model as ChatModelId)) {
    return model as ChatModelId;
  }

  return "gpt-4o-mini";
}

export const useChatPreferences = create<ChatPreferencesState>()(
  persist(
    (set, get) => ({
      byWorkspace: {},
      getPrefs: (workspaceId, defaultModel) =>
        readWorkspaceChatPrefs(get().byWorkspace, workspaceId, defaultModel),
      setModel: (workspaceId, model) =>
        set((state) => ({
          byWorkspace: {
            ...state.byWorkspace,
            [workspaceId]: {
              ...state.getPrefs(workspaceId),
              model,
            },
          },
        })),
      setWebSearch: (workspaceId, webSearch) =>
        set((state) => ({
          byWorkspace: {
            ...state.byWorkspace,
            [workspaceId]: {
              ...state.getPrefs(workspaceId),
              webSearch,
            },
          },
        })),
    }),
    { name: "sourcelab-chat-preferences" },
  ),
);

function subscribeToChatPrefHydration(onStoreChange: () => void) {
  return useChatPreferences.persist.onFinishHydration(onStoreChange);
}

function selectChatPrefsHydrated() {
  return useChatPreferences.persist.hasHydrated();
}

function selectChatPrefsHydratedOnServer() {
  return false;
}

/** Per-notebook model and web-search flag, matching the server render until persistence loads. */
export function useWorkspaceChatPrefs(
  workspaceId: string,
  defaultModel?: string,
) {
  const byWorkspace = useChatPreferences((state) => state.byWorkspace);
  const hydrated = useSyncExternalStore(
    subscribeToChatPrefHydration,
    selectChatPrefsHydrated,
    selectChatPrefsHydratedOnServer,
  );

  if (!hydrated) {
    return readWorkspaceChatPrefs({}, workspaceId, defaultModel);
  }

  return readWorkspaceChatPrefs(byWorkspace, workspaceId, defaultModel);
}
