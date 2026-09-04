import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: mocks.requireUser,
}));
vi.mock("@/lib/services/research-service", () => ({
  researchService: {
    projects: { list: mocks.list, create: mocks.create },
  },
}));

import { GET, POST } from "@/app/api/projects/route";

describe("projects API authorization", () => {
  beforeEach(() => {
    mocks.requireUser.mockReset();
    mocks.list.mockReset();
    mocks.create.mockReset();
  });

  it("rejects an unauthenticated request", async () => {
    mocks.requireUser.mockRejectedValue(new UnauthorizedError());
    const response = await GET(
      new Request("http://localhost/api/projects") as never,
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("passes only the verified user ID to the repository service", async () => {
    mocks.requireUser.mockResolvedValue({ id: "verified-user" });
    mocks.list.mockResolvedValue([]);
    const response = await GET(
      new Request("http://localhost/api/projects") as never,
    );
    expect(response.status).toBe(200);
    expect(mocks.list).toHaveBeenCalledWith("verified-user");
  });

  it("rejects invalid input before creating a project", async () => {
    mocks.requireUser.mockResolvedValue({ id: "verified-user" });
    const response = await POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "" }),
      }) as never,
    );
    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
