import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession: mocks.exchangeCodeForSession },
  })),
}));

import { GET } from "@/app/auth/callback/route";

describe("Supabase auth callback", () => {
  beforeEach(() => mocks.exchangeCodeForSession.mockReset());

  it("exchanges a valid code and permits only an internal destination", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await GET(
      new Request(
        "https://marginalia.example/auth/callback?code=valid&next=%2Fauth%2Freset-password",
      ),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://marginalia.example/auth/reset-password",
    );
  });

  it("prevents protocol-relative redirect destinations", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await GET(
      new Request(
        "https://marginalia.example/auth/callback?code=valid&next=%2F%2Fevil.example",
      ),
    );
    expect(response.headers.get("location")).toBe("https://marginalia.example/");
  });

  it("rejects missing or expired confirmation codes", async () => {
    const missing = await GET(
      new Request("https://marginalia.example/auth/callback"),
    );
    expect(missing.headers.get("location")).toContain(
      "/login?error=confirmation_failed",
    );
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
