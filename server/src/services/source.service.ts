import { uploadPdfToCloudinary } from "../lib/cloudinary.js";
import { scrapeWebsite } from "../lib/firecrawl.js";
import { fetchYoutubeTranscript } from "../lib/youtube.js";
import {
  createSourceRecord,
  deleteSourceRecord,
  findSourceByIdAndWorkspaceId,
  findSourcesByWorkspaceId,
  type SourceRecord,
} from "../repositories/source.repository.js";
import { getWorkspaceByIdForUser } from "./workspace.service.js";
import { NotFoundError } from "../types/app-error.js";
import type {
  CreateSourceInput,
  ImportWebsiteInput,
  ImportYoutubeInput,
  ListSourcesQuery,
} from "../validators/source.validator.js";

async function assertWorkspaceAccess(workspaceId: string, userId: string) {
  await getWorkspaceByIdForUser(workspaceId, userId);
}

export async function listSourcesForWorkspace(
  workspaceId: string,
  userId: string,
  filters: ListSourcesQuery = {},
) {
  await assertWorkspaceAccess(workspaceId, userId);
  return findSourcesByWorkspaceId(workspaceId, filters);
}

export async function getSourceForWorkspace(
  workspaceId: string,
  sourceId: string,
  userId: string,
): Promise<SourceRecord> {
  await assertWorkspaceAccess(workspaceId, userId);

  const source = await findSourceByIdAndWorkspaceId(sourceId, workspaceId);

  if (!source) {
    throw new NotFoundError("Source not found");
  }

  return source;
}

export async function createTextOrMarkdownSource(
  workspaceId: string,
  userId: string,
  input: CreateSourceInput,
) {
  await assertWorkspaceAccess(workspaceId, userId);

  return createSourceRecord({
    workspaceId,
    type: input.type,
    title: input.title,
    content: input.content,
    status: "PENDING",
  });
}

export async function uploadPdfSource(
  workspaceId: string,
  userId: string,
  file: Express.Multer.File,
  title?: string,
) {
  await assertWorkspaceAccess(workspaceId, userId);

  const upload = await uploadPdfToCloudinary(file.buffer, file.originalname);

  return createSourceRecord({
    workspaceId,
    type: "PDF",
    title: title?.trim() || file.originalname.replace(/\.pdf$/i, ""),
    status: "PENDING",
    metadata: {
      fileUrl: upload.secureUrl,
      fileName: upload.originalFilename,
      fileSize: upload.bytes,
      publicId: upload.publicId,
    },
  });
}

export async function importWebsiteSource(
  workspaceId: string,
  userId: string,
  input: ImportWebsiteInput,
) {
  await assertWorkspaceAccess(workspaceId, userId);

  // Scrape the website using Firecrawl and get the markdown content and title
  const scraped = await scrapeWebsite(input.url);

  return createSourceRecord({
    workspaceId,
    type: "WEBSITE",
    title: input.title?.trim() || scraped.title || input.url,
    content: scraped.markdown,
    url: scraped.sourceUrl,
    status: "PENDING",
    metadata: {
      importedFrom: scraped.sourceUrl,
    },
  });
}

export async function importYoutubeSource(
  workspaceId: string,
  userId: string,
  input: ImportYoutubeInput,
) {
  await assertWorkspaceAccess(workspaceId, userId);

  const transcript = await fetchYoutubeTranscript(input.url);

  return createSourceRecord({
    workspaceId,
    type: "YOUTUBE",
    title: input.title?.trim() || `YouTube: ${transcript.videoId}`,
    content: transcript.content,
    url: input.url,
    status: "PENDING",
    metadata: {
      videoId: transcript.videoId,
    },
  });
}

export async function deleteSourceForWorkspace(
  workspaceId: string,
  sourceId: string,
  userId: string,
) {
  await getSourceForWorkspace(workspaceId, sourceId, userId);
  await deleteSourceRecord(sourceId);
}
