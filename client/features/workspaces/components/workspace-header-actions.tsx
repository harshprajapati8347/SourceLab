"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CHAT_MODEL_LABELS,
  CHAT_MODELS,
  useChatPreferences,
  type ChatModelId,
} from "@/features/chat/stores/chat-preferences";
import type { Workspace } from "../lib/types";

type WorkspaceHeaderActionsProps = {
  workspace: Workspace;
};

/** Per-notebook chat model picker, shown in the workspace header. */
export function WorkspaceHeaderActions({
  workspace,
}: WorkspaceHeaderActionsProps) {
  const getPrefs = useChatPreferences((state) => state.getPrefs);
  const setModel = useChatPreferences((state) => state.setModel);
  const prefs = getPrefs(workspace.id, workspace.defaultModel);

  return (
    <Select
      value={prefs.model}
      items={CHAT_MODELS.map((model) => ({
        value: model,
        label: CHAT_MODEL_LABELS[model],
      }))}
      onValueChange={(value) => setModel(workspace.id, value as ChatModelId)}
    >
      <SelectTrigger
        aria-label="Chat model"
        className="hidden h-8 w-[9.5rem] lg:flex"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CHAT_MODELS.map((model) => (
          <SelectItem key={model} value={model}>
            {CHAT_MODEL_LABELS[model]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
