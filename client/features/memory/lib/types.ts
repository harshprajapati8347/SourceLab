export type UserMemory = {
  id: string;
  memory: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown> | null;
  categories?: string[];
  source: "manual" | "learned";
  scope: "user" | "workspace";
  workspaceId: string | null;
};

export type CreateMemoryInput = {
  memory: string;
  workspaceId?: string;
};

export type UpdateMemoryInput = {
  memory: string;
};
