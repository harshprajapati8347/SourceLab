/// <reference types="vitest/globals" />
import assert from "node:assert/strict";
import {
  pdfDownloadFormat,
  pdfSourceMetadata,
  readCloudinaryAsset,
  type CloudinaryUploadResult,
} from "./cloudinary.js";

describe("Cloudinary PDF assets", () => {
  it("stores the upload's public id and resource type instead of the delivery URL", () => {
    const upload: CloudinaryUploadResult = {
      secureUrl:
        "https://res.cloudinary.com/cloudwithharsh/raw/upload/v1/sourcelab/pdf/file.pdf",
      publicId: "sourcelab/pdf/file.pdf",
      bytes: 1200,
      originalFilename: "notes.pdf",
      resourceType: "raw",
    };

    const metadata = pdfSourceMetadata(upload, 3);

    assert.equal(metadata.publicId, "sourcelab/pdf/file.pdf");
    assert.equal(metadata.resourceType, "raw");
    assert.equal(metadata.fileUrl, upload.secureUrl);
    assert.equal(metadata.pageCount, 3);
    assert.equal(readCloudinaryAsset(metadata)?.publicId, upload.publicId);
  });

  it("does not invent an asset from a URL when the stored id or type is missing", () => {
    assert.equal(
      readCloudinaryAsset({
        fileUrl:
          "https://res.cloudinary.com/cloudwithharsh/raw/upload/v1/sourcelab/pdf/file.pdf",
      }),
      null,
    );
    assert.equal(
      readCloudinaryAsset({
        publicId: "sourcelab/pdf/file.pdf",
        resourceType: "video",
      }),
      null,
    );
    assert.deepEqual(
      readCloudinaryAsset({
        publicId: "sourcelab/pdf/file.pdf",
        resourceType: "image",
      }),
      { publicId: "sourcelab/pdf/file.pdf", resourceType: "image" },
    );
  });

  it("does not append a second pdf extension for raw assets", () => {
    assert.equal(
      pdfDownloadFormat("sourcelab/pdf/file.pdf", "raw"),
      undefined,
    );
    assert.equal(pdfDownloadFormat("sourcelab/pdf/file", "raw"), "pdf");
    assert.equal(pdfDownloadFormat("sourcelab/pdf/file", "image"), "pdf");
  });
});
