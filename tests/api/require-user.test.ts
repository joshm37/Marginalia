import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { upsert: mocks.upsert } } }));
vi.mock("@/lib/env", () => ({ serverEnv: vi.fn() }));
import { requireUser } from "@/lib/auth/require-user";

describe("verified account synchronization", () => {
  beforeEach(() => {
    vi.stubEnv("E2E_TEST_MODE", "false");
    mocks.upsert.mockReset();
    mocks.upsert.mockResolvedValue({});
  });

  it("ensures a missing app user and repeats safely using the authenticated ID", async () => {
    const user = { id: "verified-id", email: "shared@example.test", user_metadata: {} };
    mocks.getUser.mockResolvedValue({ data: { user }, error: null });
    await expect(requireUser()).resolves.toEqual(user);
    await requireUser();
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    expect(mocks.upsert).toHaveBeenLastCalledWith({
      where: { id: user.id },
      update: { email: user.email, displayName: undefined },
      create: { id: user.id, email: user.email, displayName: undefined },
    });
  });

  it("does not synchronize a missing or expired session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: "Expired" } });
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
