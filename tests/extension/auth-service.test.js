import { beforeEach, describe, expect, it, vi } from "vitest";

let stored;

beforeEach(() => {
  stored = undefined;
  globalThis.chrome = {
    storage: {
      local: {
        get: vi.fn(async () => ({ marginaliaSession: stored })),
        set: vi.fn(async (value) => {
          stored = value.marginaliaSession;
        }),
        remove: vi.fn(async () => {
          stored = undefined;
        }),
      },
    },
  };
  vi.restoreAllMocks();
});

describe("extension authentication", () => {
  it("persists a successful sign-in", async () => {
    const session = {
      accessToken: "access",
      refreshToken: "refresh",
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(session), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const { signIn } = await import("../../extension/auth-service.js");
    await expect(signIn("reader@example.com", "password123")).resolves.toEqual(
      session,
    );
    expect(stored).toEqual(session);
  });

  it("reuses an unexpired access token without a network call", async () => {
    stored = {
      accessToken: "cached-access",
      refreshToken: "refresh",
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { getAccessToken } = await import("../../extension/auth-service.js");
    await expect(getAccessToken()).resolves.toBe("cached-access");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes an expired session and persists the replacement", async () => {
    stored = { accessToken: "old", refreshToken: "refresh", expiresAt: 1 };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              accessToken: "new",
              refreshToken: "new-refresh",
              expiresAt: 9999999999,
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        ),
    );
    const { getAccessToken } = await import("../../extension/auth-service.js");
    await expect(getAccessToken()).resolves.toBe("new");
    expect(stored.accessToken).toBe("new");
  });
});
