import { describe, expect, it, vi } from "vitest";
import { apiError } from "@/lib/api/responses";
import { DuplicateSourceError } from "@/lib/services/source-service";

describe("API error redaction", () => {
  it("does not expose unexpected error details to the client", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = apiError(
      new Error("DATABASE_URL=postgresql://secret:password@internal/database"),
      new Request("https://example.test/api/sources"),
    );
    expect(response.status).toBe(500);
    const serialized = JSON.stringify(await response.json());
    expect(serialized).toContain("INTERNAL_ERROR");
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("postgresql");
  });

  it("returns a safe DTO instead of a raw duplicate database record", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = apiError(
      new DuplicateSourceError({
        id: "source-1",
        userId: "private-user-id",
        title: "Existing source",
        authors: null,
        organization: null,
        publicationDate: null,
        sourceType: "ARTICLE",
        url: "https://example.test/source",
        description: null,
        bibliographyAnnotation: null,
        includeInBibliography: true,
        notes: null,
        doi: null,
        citationMetadata: null,
        createdAt: new Date("2026-01-01"),
        tags: [],
        projects: [],
      }),
      new Request("https://example.test/api/sources"),
    );
    const serialized = JSON.stringify(await response.json());
    expect(serialized).toContain("Existing source");
    expect(serialized).not.toContain("private-user-id");
    expect(serialized).not.toContain("userId");
  });
});
