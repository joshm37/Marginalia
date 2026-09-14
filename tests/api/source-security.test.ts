import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  deleteSource: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/services/research-service", () => ({
  researchService: {
    sources: {
      delete: mocks.deleteSource,
      update: vi.fn(),
      moveToProject: vi.fn(),
      updateBibliographyAnnotation: vi.fn(),
    },
  },
}));

import { DELETE } from "@/app/api/sources/[id]/route";

describe("source item API security", () => {
  beforeEach(() => {
    mocks.requireUser.mockReset();
    mocks.deleteSource.mockReset();
  });

  it("rejects unauthenticated deletion before data access", async () => {
    mocks.requireUser.mockRejectedValue(new UnauthorizedError());
    const response = await DELETE(
      new Request("http://localhost/api/sources/source-1", { method: "DELETE" }) as never,
      { params: Promise.resolve({ id: "source-1" }) },
    );
    expect(response.status).toBe(401);
    expect(mocks.deleteSource).not.toHaveBeenCalled();
  });

  it("uses only the verified user ID and conceals foreign records", async () => {
    mocks.requireUser.mockResolvedValue({ id: "verified-user" });
    mocks.deleteSource.mockResolvedValue(false);
    const response = await DELETE(
      new Request("http://localhost/api/sources/foreign-source", { method: "DELETE" }) as never,
      { params: Promise.resolve({ id: "foreign-source" }) },
    );
    expect(response.status).toBe(404);
    expect(mocks.deleteSource).toHaveBeenCalledWith("verified-user", "foreign-source");
  });

  it("rejects malformed resource IDs before querying", async () => {
    mocks.requireUser.mockResolvedValue({ id: "verified-user" });
    const response = await DELETE(
      new Request("http://localhost/api/sources/bad", { method: "DELETE" }) as never,
      { params: Promise.resolve({ id: "../../foreign source" }) },
    );
    expect(response.status).toBe(400);
    expect(mocks.deleteSource).not.toHaveBeenCalled();
  });
});
