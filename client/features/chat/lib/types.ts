export type ChatCitation = {
  sourceId?: string;
  sourceTitle: string;
  sourceType: string;
  chunkId?: string;
  chunkIndex?: number;
  page?: number;
  excerpt: string;
  score?: number;
  url?: string;
  cited?: boolean;
};

export type Conversation = {
  id: string;
  workspaceId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  role: "USER" | "ASSISTANT";
  content: string;
  citations: ChatCitation[] | null;
  trace?: unknown;
  suggestions?: string[];
  createdAt: string;
};
