/// <reference types="vitest/globals" />
import assert from "node:assert/strict";
import { AppError } from "../types/app-error.js";
import { cleanupCloudinaryAssets } from "./cloudinary-cleanup.service.js";

const raw = {
  id: "source-1",
  metadata: {
    fileUrl:
      "https://res.cloudinary.com/demo/raw/upload/v1/reconstructed/from-url.pdf",
    publicId: "sourcelab/pdf/stored.pdf",
    resourceType: "raw" as const,
  },
};

describe("Cloudinary cleanup", () => {
  it("deletes a source file by the stored public id and resource type", async () => {
    const deleted: { publicId: string; resourceType: string }[] = [];

    await cleanupCloudinaryAssets([raw], {
      countSharing: async () => 0,
      deleteAsset: async (asset) => {
        deleted.push(asset);
        return "ok";
      },
      wait: async () => {},
    });

    assert.deepEqual(deleted, [
      { publicId: "sourcelab/pdf/stored.pdf", resourceType: "raw" },
    ]);
  });

  it("leaves an asset that another source still uses", async () => {
    let deleted = 0;

    await cleanupCloudinaryAssets([raw], {
      countSharing: async (publicId, excludeSourceIds) => {
        assert.equal(publicId, "sourcelab/pdf/stored.pdf");
        assert.deepEqual(excludeSourceIds, ["source-1"]);
        return 1;
      },
      deleteAsset: async () => {
        deleted += 1;
        return "ok";
      },
      wait: async () => {},
    });

    assert.equal(deleted, 0);
  });

  it("treats a missing asset as success and retries a failed delete", async () => {
    const attempts: string[] = [];

    await cleanupCloudinaryAssets([raw], {
      countSharing: async () => 0,
      deleteAsset: async () => "not found",
      wait: async () => {},
    });

    await cleanupCloudinaryAssets([raw], {
      countSharing: async () => 0,
      deleteAsset: async () => {
        attempts.push("try");
        if (attempts.length < 3) {
          throw new Error("timeout");
        }
        return "ok";
      },
      wait: async () => {},
    });

    assert.equal(attempts.length, 3);
  });

  it("throws after repeated failures so the database row can stay", async () => {
    let attempts = 0;

    await assert.rejects(
      () =>
        cleanupCloudinaryAssets([raw], {
          countSharing: async () => 0,
          deleteAsset: async () => {
            attempts += 1;
            throw new Error("denied");
          },
          wait: async () => {},
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 502);
        return true;
      },
    );
    assert.equal(attempts, 3);
  });

  it("deletes a notebook's files once, and skips files owned outside it", async () => {
    const sibling = {
      id: "source-2",
      metadata: raw.metadata,
    };
    const image = {
      id: "source-3",
      metadata: {
        publicId: "sourcelab/pdf/chart",
        resourceType: "image" as const,
      },
    };
    const plain = { id: "source-4", metadata: { importedFrom: "https://example.com" } };
    const deleted: string[] = [];

    await cleanupCloudinaryAssets([raw, sibling, image, plain], {
      countSharing: async (publicId, excludeSourceIds) => {
        assert.deepEqual(excludeSourceIds.sort(), [
          "source-1",
          "source-2",
          "source-3",
          "source-4",
        ]);
        return publicId === "sourcelab/pdf/chart" ? 1 : 0;
      },
      deleteAsset: async (asset) => {
        deleted.push(`${asset.resourceType}:${asset.publicId}`);
        return "ok";
      },
      wait: async () => {},
    });

    assert.deepEqual(deleted, ["raw:sourcelab/pdf/stored.pdf"]);
  });
});
