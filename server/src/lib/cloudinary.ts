import { v2 as cloudinary } from "cloudinary";
import { ValidationError } from "../types/app-error.js";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET ?? "sourcelab";
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

export type CloudinaryResourceType = "raw" | "image";

export type CloudinaryAssetRef = {
  publicId: string;
  resourceType: CloudinaryResourceType;
};

export type CloudinaryUploadResult = {
  secureUrl: string;
  publicId: string;
  bytes: number;
  originalFilename: string;
  resourceType: CloudinaryResourceType;
};

/** How long an Open PDF link stays valid. The API signature is minted at click time. */
const PDF_LINK_TTL_SECONDS = 15 * 60;

type CloudinaryUploadResponse = {
  secure_url: string;
  public_id: string;
  bytes: number;
  resource_type?: string;
  error?: { message: string };
};

/**
 * Reads the asset id stored on a source. URLs are not parsed.
 *
 * @param metadata - Source metadata JSON
 * @returns The stored public id and resource type, or null when either is missing
 */
export function readCloudinaryAsset(metadata: unknown): CloudinaryAssetRef | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  const publicId = record.publicId;
  const resourceType = record.resourceType;
  if (typeof publicId !== "string" || !publicId.trim()) {
    return null;
  }
  if (resourceType !== "raw" && resourceType !== "image") {
    return null;
  }

  return { publicId, resourceType };
}

/**
 * Metadata persisted for a PDF upload. The public id comes from Cloudinary, not the URL.
 *
 * @param upload - Upload response
 * @param pageCount - Page count when extraction succeeded at upload time
 * @returns Metadata fields stored on the source
 */
export function pdfSourceMetadata(
  upload: CloudinaryUploadResult,
  pageCount?: number,
) {
  return {
    fileUrl: upload.secureUrl,
    fileName: upload.originalFilename,
    fileSize: upload.bytes,
    publicId: upload.publicId,
    resourceType: upload.resourceType,
    ...(pageCount != null ? { pageCount } : {}),
  };
}

/**
 * Picks the format argument for a private PDF download.
 *
 * Raw public ids already end in `.pdf`. Passing format again makes Cloudinary
 * look up `file.pdf.pdf` and return 404. Image assets keep the format separate.
 *
 * @param publicId - Stored Cloudinary public id
 * @param resourceType - Stored resource type
 * @returns `pdf`, or undefined when the raw id already includes the extension
 */
export function pdfDownloadFormat(
  publicId: string,
  resourceType: CloudinaryResourceType,
) {
  if (resourceType === "raw" && publicId.toLowerCase().endsWith(".pdf")) {
    return undefined;
  }
  return "pdf";
}

/**
 * Builds a short-lived download URL for a stored PDF.
 *
 * Public CDN links for this cloud return 401 (`deny or ACL failure`) when the
 * path ends in `.pdf`. The signed Admin API download still returns the file.
 *
 * @param asset - Stored public id and resource type
 * @returns Download URL, or null when Cloudinary API credentials are missing
 */
export function getPdfDeliveryUrl(asset: CloudinaryAssetRef) {
  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }

  configureCloudinary();
  // Raw ids that already end in `.pdf` must omit format. The SDK types require a string.
  const format = pdfDownloadFormat(asset.publicId, asset.resourceType) as string;
  return cloudinary.utils.private_download_url(
    asset.publicId,
    format,
    {
      resource_type: asset.resourceType,
      type: "upload",
      expires_at: Math.floor(Date.now() / 1000) + PDF_LINK_TTL_SECONDS,
    },
  );
}

/**
 * Deletes one stored asset. A missing asset is success so a retry can finish.
 *
 * @param asset - Stored public id and resource type
 * @returns `ok` when the asset was deleted, or `not found` when it was already gone
 * @throws When Cloudinary is not configured or the API rejects the delete
 */
export async function deleteCloudinaryAssetOnce(asset: CloudinaryAssetRef) {
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary is not configured");
  }

  configureCloudinary();
  const result = (await cloudinary.uploader.destroy(asset.publicId, {
    resource_type: asset.resourceType,
    type: "upload",
    invalidate: true,
  })) as { result?: string };

  if (result.result === "ok" || result.result === "not found") {
    return result.result;
  }

  throw new Error(
    `Cloudinary could not delete the file (${result.result ?? "unknown"})`,
  );
}

function configureCloudinary() {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

export function getSignedCloudinaryDownloadUrl(
  publicId: string,
  resourceType: CloudinaryResourceType = "raw",
) {
  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }

  configureCloudinary();

  return cloudinary.url(publicId, {
    resource_type: resourceType,
    type: "upload",
    sign_url: true,
    secure: true,
  });
}

/**
 * Uploads a PDF buffer to Cloudinary using an unsigned upload preset.
 *
 * @param buffer - PDF file bytes from Multer
 * @param filename - Original filename (used in the multipart form)
 * @returns Upload metadata including secure URL and public id
 * @throws {ValidationError} When Cloudinary is not configured or upload is rejected
 *
 */
export async function uploadPdfToCloudinary(
  buffer: Buffer,
  filename: string,
): Promise<CloudinaryUploadResult> {
  if (!cloudName) {
    throw new ValidationError("Cloudinary is not configured on the server");
  }

  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: "application/pdf" }),
    filename,
  );
  form.append("upload_preset", uploadPreset);
  form.append("folder", "sourcelab/pdfs");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`,
    { method: "POST", body: form },
  );

  const result = (await response.json()) as CloudinaryUploadResponse;

  if (!response.ok) {
    const message =
      result.error?.message ?? `Cloudinary upload failed (${response.status})`;

    if (response.status === 403) {
      throw new ValidationError(
        "Cloudinary rejected the upload. Check CLOUDINARY_UPLOAD_PRESET in server/.env matches an unsigned preset in your dashboard.",
      );
    }

    throw new ValidationError(message);
  }

  return {
    secureUrl: result.secure_url,
    publicId: result.public_id,
    bytes: result.bytes,
    originalFilename: filename,
    resourceType: result.resource_type === "image" ? "image" : "raw",
  };
}
