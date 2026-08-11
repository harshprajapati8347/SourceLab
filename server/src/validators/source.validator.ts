import { z } from "zod";

// Define the source type schema
export const sourceTypeSchema = z.enum([
  "PDF",
  "WEBSITE",
  "YOUTUBE",
  "TEXT",
  "MARKDOWN",
]);

// Define the source status schema
export const sourceStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "READY",
  "FAILED",
]);

// Define the workspace ID parameter schema
export const workspaceIdParamSchema = z.object({
  workspaceId: z.string().trim().min(1),
});

// Define the source ID parameter schema
export const sourceIdParamSchema = z.object({
  workspaceId: z.string().trim().min(1),
  sourceId: z.string().trim().min(1),
});

// Define the list sources query schema
export const listSourcesQuerySchema = z.object({
  q: z.string().trim().optional(),
  type: sourceTypeSchema.optional(),
  status: sourceStatusSchema.optional(),
});

// Define the create text source schema
export const createTextSourceSchema = z.object({
  type: z.literal("TEXT"),
  title: z.string().trim().min(1, "Title is required").max(200),
  content: z.string().trim().min(1, "Content is required"),
});

// Define the create markdown source schema
export const createMarkdownSourceSchema = z.object({
  type: z.literal("MARKDOWN"),
  title: z.string().trim().min(1, "Title is required").max(200),
  content: z.string().trim().min(1, "Content is required"),
});

// Define the create source schema
export const createSourceSchema = z.discriminatedUnion("type", [
  createTextSourceSchema,
  createMarkdownSourceSchema,
]);

// Define the import website schema
export const importWebsiteSchema = z.object({
  url: z.string().trim().url("Enter a valid URL"),
  title: z.string().trim().max(200).optional(),
});

// Define the import youtube schema
export const importYoutubeSchema = z.object({
  url: z.string().trim().min(1, "YouTube URL is required"),
  title: z.string().trim().max(200).optional(),
});

export type CreateSourceInput = z.infer<typeof createSourceSchema>;
export type ListSourcesQuery = z.infer<typeof listSourcesQuerySchema>;
export type ImportWebsiteInput = z.infer<typeof importWebsiteSchema>;
export type ImportYoutubeInput = z.infer<typeof importYoutubeSchema>;
