import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  deleteMany: vi.fn(),
  findFirst: vi.fn(),
  deleteAuthUser: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { user: { deleteMany: mocks.deleteMany, findFirst: mocks.findFirst } },
}));
vi.mock("@/lib/env", () => ({
  serverEnv: () => ({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { admin: { deleteUser: mocks.deleteAuthUser } } }),
}));

import { DELETE } from "@/app/api/account/route";
import { GET } from "@/app/api/account/export/route";

function deletionRequest(body: unknown = { confirmation: "DELETE" }) {
  return new Request("http://localhost/api/account", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("account deletion and export", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-only-test-key");
    mocks.requireUser.mockReset();
    mocks.deleteMany.mockReset().mockResolvedValue({ count: 1 });
    mocks.findFirst.mockReset();
    mocks.deleteAuthUser.mockReset().mockResolvedValue({ error: null });
  });

  it("rejects unauthenticated deletion before accessing data or Admin Auth", async () => {
    mocks.requireUser.mockRejectedValue(new UnauthorizedError());
    const response = await DELETE(deletionRequest() as never);
    expect(response.status).toBe(401);
    expect(mocks.deleteMany).not.toHaveBeenCalled();
    expect(mocks.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("requires the explicit destructive confirmation", async () => {
    mocks.requireUser.mockResolvedValue({ id: "user-1" });
    const response = await DELETE(deletionRequest({ confirmation: "delete" }) as never);
    expect(response.status).toBe(400);
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("cascades application data before securely deleting the Auth user", async () => {
    mocks.requireUser.mockResolvedValue({ id: "user-1" });
    const response = await DELETE(deletionRequest() as never);
    expect(response.status).toBe(204);
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(mocks.deleteAuthUser).toHaveBeenCalledWith("user-1");
    expect(mocks.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteAuthUser.mock.invocationCallOrder[0],
    );
  });

  it("reports Auth cleanup failure after the idempotent data cascade so deletion can be retried", async () => {
    mocks.requireUser.mockResolvedValue({ id: "user-1" });
    mocks.deleteAuthUser.mockResolvedValueOnce({
      error: { name: "AuthApiError", status: 503 },
    });
    const response = await DELETE(deletionRequest() as never);
    expect(response.status).toBe(500);
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(mocks.deleteAuthUser).toHaveBeenCalledWith("user-1");
    await expect(response.json()).resolves.toMatchObject({
      code: "INTERNAL_ERROR",
      error: "An unexpected server error occurred",
    });
  });

  it("rejects unauthenticated exports before querying data", async () => {
    mocks.requireUser.mockRejectedValue(new UnauthorizedError());
    const response = await GET(new Request("http://localhost/api/account/export") as never);
    expect(response.status).toBe(401);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("exports a versioned relational archive for only the verified user", async () => {
    mocks.requireUser.mockResolvedValue({ id: "user-1" });
    mocks.findFirst.mockResolvedValue({
      id: "user-1", email: "reader@example.test", displayName: "Reader",
      createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-02"),
      projects: [{ id: "project-1", name: "Research" }],
      tags: [{ id: "tag-1", name: "evidence" }],
      contributors: [{ id: "person-1", family: "Ng", given: "A", literal: null }],
      sources: [{ id: "source-1", title: "Study", notes: "Source note", citationMetadata: { language: "en" }, fileUrl: "https://files.example.test/a.pdf", projects: [{ projectId: "project-1" }], tags: [{ tagId: "tag-1" }], contributors: [{ contributorId: "person-1", role: "AUTHOR", sequence: 0 }], excerpts: [{ id: "excerpt-1" }] }],
      excerpts: [{ id: "excerpt-1", sourceId: "source-1", selectedText: "Evidence", note: "Excerpt note", projects: [{ projectId: "project-1" }], tags: [{ tagId: "tag-1" }] }],
    });
    const response = await GET(new Request("http://localhost/api/account/export") as never);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "user-1" } }));
    await expect(response.json()).resolves.toMatchObject({
      format: "marginalia-account-export", version: 1,
      account: { id: "user-1", email: "reader@example.test" },
      sources: [{ id: "source-1", notes: "Source note", projects: [{ projectId: "project-1" }] }],
      excerpts: [{ id: "excerpt-1", note: "Excerpt note" }],
      files: [{ sourceId: "source-1", reference: "https://files.example.test/a.pdf" }],
    });
  });
});
