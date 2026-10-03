import { z } from "zod";

export const memoryIdParamSchema = z.object({
  memoryId: z.string().trim().min(1),
});

export const memoryScopeQuerySchema = z.object({
  workspaceId: z.string().trim().min(1).optional(),
});

export const createMemorySchema = z.object({
  memory: z.string().trim().min(1).max(2000),
  workspaceId: z.string().trim().min(1).optional(),
});

export const updateMemorySchema = z.object({
  memory: z.string().trim().min(1).max(2000),
});
