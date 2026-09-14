import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $queryRaw: mocks.queryRaw,
    rateLimitBucket: { deleteMany: mocks.deleteMany },
  },
}));

import { enforceRateLimit, requestClientKey, sensitiveValueKey } from "@/lib/api/rate-limit";

describe("shared rate limiting", () => {
  beforeEach(() => {
    mocks.queryRaw.mockReset();
    mocks.deleteMany.mockReset().mockResolvedValue({ count: 0 });
  });

  it("allows requests within the database-backed bucket", async () => {
    mocks.queryRaw.mockResolvedValue([{ count: 1, resetAt: new Date(Date.now() + 60_000) }]);
    await expect(
      enforceRateLimit({ namespace: "test", identifier: "user", limit: 2, windowSeconds: 60 }),
    ).resolves.toBeUndefined();
  });

  it("returns a retry interval after the shared limit is exceeded", async () => {
    mocks.queryRaw.mockResolvedValue([{ count: 3, resetAt: new Date(Date.now() + 30_000) }]);
    await expect(
      enforceRateLimit({ namespace: "test", identifier: "user", limit: 2, windowSeconds: 60 }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED", retryAfter: expect.any(Number) });
  });

  it("hashes IP and account identifiers before storage", () => {
    const request = new Request("https://example.test", { headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" } });
    expect(requestClientKey(request)).toMatch(/^[a-f0-9]{64}$/);
    expect(sensitiveValueKey("Reader@Example.com")).toMatch(/^[a-f0-9]{64}$/);
    expect(sensitiveValueKey("Reader@Example.com")).not.toContain("reader@example.com");
  });
});
