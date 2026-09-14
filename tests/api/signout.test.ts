import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { signOut: mocks.signOut } })),
}));

import { POST } from "@/app/auth/signout/route";

describe("sign out", () => {
  it("rejects a cross-site request", async () => {
    const response = await POST(
      new Request("https://marginalia.example/auth/signout", {
        method: "POST",
        headers: { origin: "https://evil.example" },
      }),
    );
    expect(response.status).toBe(403);
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});
