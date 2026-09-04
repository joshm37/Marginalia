import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("../../extension/auth-service.js", () => auth);

import { enrichDoi, getProjects } from "../../extension/api-service.js";

describe("extension API client", () => {
  beforeEach(() => {
    auth.getAccessToken.mockReset().mockResolvedValue("extension-token");
    auth.signOut.mockReset().mockResolvedValue(undefined);
  });

  it("adds the persistent session token to backend requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: "project-1" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(getProjects()).resolves.toEqual([{ id: "project-1" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/projects",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer extension-token",
        }),
      }),
    );
  });

  it("clears an invalid extension session after a 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    await expect(getProjects()).rejects.toThrow("Your session expired");
    expect(auth.signOut).toHaveBeenCalledOnce();
  });

  it("requests enrichment only when the popup supplies a detected DOI", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ enriched: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await enrichDoi("10.5555/example");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/sources/enrich",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ doi: "10.5555/example" }),
      }),
    );
  });
});
