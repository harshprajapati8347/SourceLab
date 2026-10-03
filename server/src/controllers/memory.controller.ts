import type { Request, Response } from "express";
import {
  createMemoryForUser,
  deleteMemoryForUser,
  listMemoriesForUser,
  updateMemoryForUser,
} from "../services/memory.service.js";
import {
  createMemorySchema,
  memoryIdParamSchema,
  memoryScopeQuerySchema,
  updateMemorySchema,
} from "../validators/memory.validator.js";

export async function listMemories(req: Request, res: Response) {
  const { workspaceId } = memoryScopeQuerySchema.parse(req.query);
  const memories = await listMemoriesForUser(req.session.user.id, workspaceId);
  res.json(memories);
}

export async function createMemory(req: Request, res: Response) {
  const input = createMemorySchema.parse(req.body);
  const memory = await createMemoryForUser(req.session.user.id, input);
  res.status(201).json(memory);
}

export async function updateMemory(req: Request, res: Response) {
  const { memoryId } = memoryIdParamSchema.parse(req.params);
  const { workspaceId } = memoryScopeQuerySchema.parse(req.query);
  const input = updateMemorySchema.parse(req.body);
  const memory = await updateMemoryForUser(
    req.session.user.id,
    memoryId,
    input,
    workspaceId,
  );
  res.json(memory);
}

export async function deleteMemory(req: Request, res: Response) {
  const { memoryId } = memoryIdParamSchema.parse(req.params);
  const { workspaceId } = memoryScopeQuerySchema.parse(req.query);
  await deleteMemoryForUser(req.session.user.id, memoryId, workspaceId);
  res.status(204).send();
}
