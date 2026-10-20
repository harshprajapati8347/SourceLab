/// <reference types="vitest/globals" />
import assert from "node:assert/strict";
import { AppError } from "../types/app-error.js";

const mocks = vi.hoisted(() => ({
  findWorkspaceByIdAndUserId: vi.fn(),
  deleteWorkspaceRecord: vi.fn(),
  findSourceAssetRows: vi.fn(),
  cleanupCloudinaryAssets: vi.fn(),
  deleteWorkspaceVectors: vi.fn(),
  deleteMemoriesForWorkspace: vi.fn(),
}));

vi.mock("../repositories/workspace.repository.js", () => ({
  findWorkspaceByIdAndUserId: mocks.findWorkspaceByIdAndUserId,
  deleteWorkspaceRecord: mocks.deleteWorkspaceRecord,
  updateWorkspaceRecord: vi.fn(),
}));

vi.mock("../repositories/source.repository.js", () => ({
  findSourceAssetRows: mocks.findSourceAssetRows,
}));

vi.mock("./cloudinary-cleanup.service.js", () => ({
  cleanupCloudinaryAssets: mocks.cleanupCloudinaryAssets,
}));

vi.mock("../lib/pinecone.js", () => ({
  deleteWorkspaceVectors: mocks.deleteWorkspaceVectors,
}));

vi.mock("./memory.service.js", () => ({
  deleteMemoriesForWorkspace: mocks.deleteMemoriesForWorkspace,
}));

const pdf = {
  id: "source-1",
  metadata: {
    publicId: "sourcelab/pdf/stored.pdf",
    resourceType: "raw",
  },
};

describe("notebook deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findWorkspaceByIdAndUserId.mockResolvedValue({ id: "notebook-1" });
    mocks.findSourceAssetRows.mockResolvedValue([pdf]);
    mocks.cleanupCloudinaryAssets.mockResolvedValue(undefined);
    mocks.deleteWorkspaceVectors.mockResolvedValue(undefined);
    mocks.deleteMemoriesForWorkspace.mockResolvedValue(undefined);
    mocks.deleteWorkspaceRecord.mockResolvedValue(undefined);
  });

  it("cleans Cloudinary assets before deleting the notebook", async () => {
    const { deleteWorkspaceForUser } = await import("./workspace.service.js");
    const order: string[] = [];
    mocks.cleanupCloudinaryAssets.mockImplementation(async () => {
      order.push("cloudinary");
    });
    mocks.deleteWorkspaceRecord.mockImplementation(async () => {
      order.push("database");
    });

    await deleteWorkspaceForUser("notebook-1", "user-1");

    assert.deepEqual(mocks.cleanupCloudinaryAssets.mock.calls[0]?.[0], [pdf]);
    assert.deepEqual(order, ["cloudinary", "database"]);
  });

  it("keeps the notebook when Cloudinary cleanup fails", async () => {
    const { deleteWorkspaceForUser } = await import("./workspace.service.js");
    mocks.cleanupCloudinaryAssets.mockRejectedValue(
      new AppError(502, "Could not delete the uploaded file. Try again."),
    );

    await assert.rejects(() => deleteWorkspaceForUser("notebook-1", "user-1"));
    assert.equal(mocks.deleteWorkspaceRecord.mock.calls.length, 0);
  });
});
