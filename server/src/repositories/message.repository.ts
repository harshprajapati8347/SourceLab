import type { Prisma } from "../generated/prisma/client.js";
import prisma from "../lib/db.js";

export const messageSelect = {
  id: true,
  conversationId: true,
  role: true,
  content: true,
  citations: true,
  trace: true,
  createdAt: true,
} as const;

export type MessageRecord = Prisma.MessageGetPayload<{
  select: typeof messageSelect;
}>;

export type CreateMessageData = {
  conversationId: string;
  role: MessageRecord["role"];
  content: string;
  citations?: Prisma.InputJsonValue;
  trace?: Prisma.InputJsonValue;
};

export function findMessagesByConversationId(conversationId: string) {
  return prisma.message.findMany({
    where: { conversationId },
    select: messageSelect,
    orderBy: { createdAt: "asc" },
  });
}

export function countMessagesByConversationId(conversationId: string) {
  return prisma.message.count({
    where: { conversationId },
  });
}

export function createMessageRecord(data: CreateMessageData) {
  return prisma.message.create({
    data: {
      conversationId: data.conversationId,
      role: data.role,
      content: data.content,
      citations: data.citations,
      trace: data.trace,
    },
    select: messageSelect,
  });
}
