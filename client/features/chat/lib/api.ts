import { apiFetch } from "@/shared/lib/api";
import type { ChatMessage, Conversation } from "./types";

export function listConversations(workspaceId: string) {
  return apiFetch<Conversation[]>(
    `/api/workspaces/${workspaceId}/conversations`,
  );
}

export function createConversation(workspaceId: string, title?: string) {
  return apiFetch<Conversation>(
    `/api/workspaces/${workspaceId}/conversations`,
    {
      method: "POST",
      body: JSON.stringify(title ? { title } : {}),
    },
  );
}

export function listConversationMessages(
  workspaceId: string,
  conversationId: string,
) {
  return apiFetch<ChatMessage[]>(
    `/api/workspaces/${workspaceId}/conversations/${conversationId}/messages`,
  );
}

export function deleteConversation(
  workspaceId: string,
  conversationId: string,
) {
  return apiFetch<void>(
    `/api/workspaces/${workspaceId}/conversations/${conversationId}`,
    { method: "DELETE" },
  );
}

export function parseCitations(value: unknown): ChatMessage["citations"] {
  if (!Array.isArray(value)) {
    return null;
  }

  return value.filter(
    (item): item is NonNullable<ChatMessage["citations"]>[number] => {
      if (typeof item !== "object" || item === null) {
        return false;
      }

      const record = item as {
        sourceTitle?: unknown;
        sourceId?: unknown;
        url?: unknown;
      };

      return (
        typeof record.sourceTitle === "string" &&
        (typeof record.sourceId === "string" || typeof record.url === "string")
      );
    },
  );
}
