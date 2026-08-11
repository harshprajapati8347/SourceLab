import { ValidationError } from "../types/app-error.js";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET ?? "dt2jgaj48";

export type CloudinaryUploadResult = {
  secureUrl: string;
  publicId: string;
  bytes: number;
  originalFilename: string;
};

type CloudinaryUploadResponse = {
  secure_url: string;
  public_id: string;
  bytes: number;
  error?: { message: string };
};

export async function uploadPdfToCloudinary(
  buffer: Buffer,
  filename: string,
): Promise<CloudinaryUploadResult> {
  if (!cloudName) {
    throw new ValidationError("Cloudinary is not configured on the server");
  }

  if (!uploadPreset) {
    throw new ValidationError(
      "CLOUDINARY_UPLOAD_PRESET is required for PDF uploads",
    );
  }

  const form = new FormData();
  form.append(
    "file",
    new Blob([buffer], { type: "application/pdf" }),
    filename,
  );
  form.append("upload_preset", uploadPreset);
  form.append("folder", "sourcelab/pdfs");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
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
  };
}
