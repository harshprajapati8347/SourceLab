/// <reference types="vitest/globals" />
import assert from "node:assert/strict";
import { AppError } from "../types/app-error.js";

const mocks = vi.hoisted(() => ({
  getWorkspaceByIdForUser: vi.fn(),
  findSourceByIdAndWorkspaceId: vi.fn(),
  deleteSourceRecord: vi.fn(),
  removeSourceFromIndex: vi.fn(),
  cleanupCloudinaryAssets: vi.fn(),
}));

vi.mock("../repositories/source.repository.js", () => ({
  createSourceRecord: vi.fn(),
  deleteSourceRecord: mocks.deleteSourceRecord,
  findSourceByIdAndWorkspaceId: mocks.findSourceByIdAndWorkspaceId,
  findSourcesByWorkspaceId: vi.fn(),
  updateSourceRecord: vi.fn(),
}));

vi.mock("./workspace.service.js", () => ({
  getWorkspaceByIdForUser: mocks.getWorkspaceByIdForUser,
}));

vi.mock("./cloudinary-cleanup.service.js", () => ({
  cleanupCloudinaryAssets: mocks.cleanupCloudinaryAssets,
}));

vi.mock("./source-processing.service.js", () => ({
  removeSourceFromIndex: mocks.removeSourceFromIndex,
  listChunksForSource: vi.fn(),
}));

vi.mock("./credits.service.js", () => ({
  assertMinimumCredits: vi.fn(),
  checkAndDeductCredits: vi.fn(),
}));

vi.mock("../lib/source-events.js", () => ({
  enqueueSourceProcessing: vi.fn(),
}));

const pdf = {
  id: "source-1",
  workspaceId: "notebook-1",
  type: "PDF",
  metadata: {
    publicId: "sourcelab/pdf/stored.pdf",
    resourceType: "raw",
    fileUrl: "https://res.cloudinary.com/demo/raw/upload/v1/other.pdf",
  },
};

describe("source and notebook deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWorkspaceByIdForUser.mockResolvedValue({ id: "notebook-1" });
    mocks.findSourceByIdAndWorkspaceId.mockResolvedValue(pdf);
    mocks.cleanupCloudinaryAssets.mockResolvedValue(undefined);
    mocks.removeSourceFromIndex.mockResolvedValue(undefined);
    mocks.deleteSourceRecord.mockResolvedValue(undefined);
  });

  it("removes the Cloudinary asset before the source row", async () => {
    const { deleteSourceForWorkspace } = await import("./source.service.js");
    const order: string[] = [];
    mocks.cleanupCloudinaryAssets.mockImplementation(async () => {
      order.push("cloudinary");
    });
    mocks.deleteSourceRecord.mockImplementation(async () => {
      order.push("database");
    });

    await deleteSourceForWorkspace("notebook-1", "source-1", "user-1");

    assert.deepEqual(mocks.cleanupCloudinaryAssets.mock.calls[0]?.[0], [pdf]);
    assert.deepEqual(order, ["cloudinary", "database"]);
  });

  it("keeps the source when Cloudinary cleanup fails", async () => {
    const { deleteSourceForWorkspace } = await import("./source.service.js");
    mocks.cleanupCloudinaryAssets.mockRejectedValue(
      new AppError(502, "Could not delete the uploaded file. Try again."),
    );

    await assert.rejects(() =>
      deleteSourceForWorkspace("notebook-1", "source-1", "user-1"),
    );
    assert.equal(mocks.deleteSourceRecord.mock.calls.length, 0);
    assert.equal(mocks.removeSourceFromIndex.mock.calls.length, 0);
  });
});
