/**
 * Deletes Cloudinary files that belong to a source or a notebook.
 *
 * Assets are addressed by the stored public id and resource type. A file that
 * another source still references is left in place. A missing file counts as
 * success so deleting the same source twice can finish the database row.
 */

import {
  deleteCloudinaryAssetOnce,
  readCloudinaryAsset,
  type CloudinaryAssetRef,
} from "../lib/cloudinary.js";
import { countSourcesWithPublicId } from "../repositories/source.repository.js";
import { AppError } from "../types/app-error.js";

const ATTEMPTS = 3;

type SourceAssetRow = {
  id: string;
  metadata: unknown;
};

type CleanupDeps = {
  countSharing: (publicId: string, excludeSourceIds: string[]) => Promise<number>;
  deleteAsset: (asset: CloudinaryAssetRef) => Promise<"ok" | "not found">;
  wait: (ms: number) => Promise<void>;
};

const defaultDeps: CleanupDeps = {
  countSharing: countSourcesWithPublicId,
  deleteAsset: deleteCloudinaryAssetOnce,
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * Deletes Cloudinary assets for these sources when no other source uses them.
 *
 * @param sources - Sources about to be removed, including ones with no file
 * @param deps - Overrides used by tests
 * @throws {AppError} After three failed delete attempts. The database row should stay
 */
export async function cleanupCloudinaryAssets(
  sources: SourceAssetRow[],
  deps: Partial<CleanupDeps> = {},
) {
  const { countSharing, deleteAsset, wait } = { ...defaultDeps, ...deps };
  const excludeSourceIds = sources.map((source) => source.id);
  const assets = uniqueAssets(sources);

  for (const asset of assets) {
    const shared = await countSharing(asset.publicId, excludeSourceIds);
    if (shared > 0) {
      continue;
    }
    await deleteWithRetry(asset, deleteAsset, wait);
  }
}

function uniqueAssets(sources: SourceAssetRow[]) {
  const assets: CloudinaryAssetRef[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    const asset = readCloudinaryAsset(source.metadata);
    if (!asset) {
      continue;
    }
    const key = `${asset.resourceType}:${asset.publicId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    assets.push(asset);
  }

  return assets;
}

async function deleteWithRetry(
  asset: CloudinaryAssetRef,
  deleteAsset: CleanupDeps["deleteAsset"],
  wait: CleanupDeps["wait"],
) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      await deleteAsset(asset);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < ATTEMPTS) {
        await wait(200 * attempt);
      }
    }
  }

  console.error("Cloudinary cleanup failed:", lastError);
  throw new AppError(502, "Could not delete the uploaded file. Try again.");
}
