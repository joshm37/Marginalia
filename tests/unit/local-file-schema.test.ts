import { describe, expect, it } from "vitest";
import { duplicateQuerySchema, localFileInputSchema, sourceInputSchema } from "@/lib/api/schemas";

const hash = "a".repeat(64);

describe("local-file API validation", () => {
  it("accepts and normalizes local PDF metadata", () => {
    const result = sourceInputSchema.parse({
      title: "A local article",
      type: "Article",
      storageMode: "LOCAL",
      localFile: {
        sha256: hash.toUpperCase(),
        filename: "article.pdf",
        fileSize: 4096,
        mimeType: "APPLICATION/PDF",
        lastModified: "2026-09-13T12:00:00.000Z",
      },
      projects: ["project-1"],
      tags: [],
    });
    expect(result.url).toBeUndefined();
    expect(result.localFile?.sha256).toBe(hash);
    expect(result.localFile?.mimeType).toBe("application/pdf");
    expect(result.localFile?.lastModified).toBeInstanceOf(Date);
  });

  const localSource = {
      title: "Local PDF",
      type: "Article",
      storageMode: "LOCAL",
      localFile: { sha256: hash, filename: "paper.pdf", fileSize: 10, mimeType: "application/pdf" },
      projects: ["project-1"],
      tags: [],
  } as const;

  it("A: accepts a LOCAL source carrying a file URL and discards it", () => {
    const result = sourceInputSchema.parse({
      ...localSource,
      url: "file:///Users/name/Downloads/paper.pdf",
    });
    expect(result.url).toBeUndefined();
  });

  it("B: accepts a LOCAL source with no URL", () => {
    expect(sourceInputSchema.parse(localSource).url).toBeUndefined();
  });

  it("C: discards a nested file URL before citation validation", () => {
    const result = sourceInputSchema.parse({
      ...localSource,
      citationData: {
        title: "Local PDF",
        type: "article-journal",
        authors: [],
        url: "file:///Users/name/Downloads/paper.pdf",
      },
    });
    expect(result.citationData?.url).toBeUndefined();
  });

  it("D: strips canonical and deeply nested local file references", () => {
    const result = sourceInputSchema.parse({
      ...localSource,
      canonicalUrl: "file:///Users/name/Downloads/paper.pdf",
      citationData: {
        title: "Local PDF",
        type: "article-journal",
        authors: [],
        originalUrl: "file:///Users/name/Downloads/paper.pdf",
        providerData: { path: "/Users/name/Downloads/paper.pdf" },
      },
    });
    expect(result.canonicalUrl).toBeUndefined();
    expect(JSON.stringify(result.citationData)).not.toContain("/Users/name");
  });

  it("E: rejects a WEB source carrying a file URL", () => {
    expect(sourceInputSchema.safeParse({
      ...localSource,
      storageMode: "WEB",
      localFile: undefined,
      url: "file:///Users/name/Downloads/paper.pdf",
    }).success).toBe(false);
  });

  it("F: preserves normal WEB source validation", () => {
    const result = sourceInputSchema.parse({
      ...localSource,
      storageMode: "WEB",
      localFile: undefined,
      url: "https://example.org/paper",
    });
    expect(result.url).toBe("https://example.org/paper");
  });

  it("G: strips a LOCAL transport URL but preserves a genuine bibliographic HTTP URL", () => {
    const result = sourceInputSchema.parse({
      ...localSource,
      url: "https://example.org/should-not-be-source-identity",
      citationData: {
        title: "Local PDF",
        type: "article-journal",
        authors: [],
        url: "https://publisher.example/article",
      },
    });
    expect(result.url).toBeUndefined();
    expect(result.citationData?.url).toBe("https://publisher.example/article");
  });

  it.each([
    { ...localFileInputSchema.parse({ sha256: hash, filename: "ok.pdf", fileSize: 1, mimeType: "application/pdf" }), sha256: "not-a-hash" },
    { sha256: hash, filename: "/Users/name/paper.pdf", fileSize: 1, mimeType: "application/pdf" },
    { sha256: hash, filename: "paper.pdf", fileSize: -1, mimeType: "application/pdf" },
    { sha256: hash, filename: "paper.pdf", fileSize: 1, mimeType: "invalid" },
  ])("rejects malformed or path-bearing file metadata", (input) => {
    expect(localFileInputSchema.safeParse(input).success).toBe(false);
  });

  it("requires metadata for LOCAL sources and an URL for default WEB sources", () => {
    expect(sourceInputSchema.safeParse({ title: "Local", storageMode: "LOCAL", projects: ["p"] }).success).toBe(false);
    expect(sourceInputSchema.safeParse({ title: "Web", projects: ["p"] }).success).toBe(false);
  });

  it("supports hash-only duplicate checks", () => {
    expect(duplicateQuerySchema.parse({ fileHash: hash.toUpperCase() })).toEqual({ fileHash: hash });
  });
});
