import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  createSource: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/services/research-service", () => ({
  researchService: {
    sources: {
      create: mocks.createSource,
      list: vi.fn(),
      listPage: vi.fn(),
    },
  },
}));

import { POST } from "@/app/api/sources/route";

function storedLocalSource() {
  return {
    id: "local-source-1",
    title: "Example PDF",
    authors: null,
    organization: null,
    publicationDate: null,
    sourceType: "ARTICLE",
    url: null,
    description: null,
    bibliographyAnnotation: null,
    includeInBibliography: true,
    notes: null,
    doi: null,
    citationMetadata: null,
    containerTitle: null,
    volume: null,
    issue: null,
    pages: null,
    publisher: null,
    publisherPlace: null,
    edition: null,
    isbn: null,
    issn: null,
    accessedDate: null,
    language: null,
    metadataNeedsReview: true,
    storageMode: "LOCAL",
    localFile: {
      sha256: "a".repeat(64),
      filename: "example.pdf",
      fileSize: BigInt(1024),
      mimeType: "application/pdf",
      lastModified: null,
    },
    contributors: [],
    createdAt: new Date("2026-09-14T00:00:00.000Z"),
    tags: [],
    projects: [{ projectId: "project-1" }],
  };
}

describe("local source create route", () => {
  beforeEach(() => {
    mocks.requireUser.mockResolvedValue({ id: "verified-user" });
    mocks.createSource.mockResolvedValue(storedLocalSource());
  });

  it("accepts the real UI payload boundary and removes a leaked file URL before service invocation", async () => {
    const response = await POST(new NextRequest("http://localhost/api/sources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "temporary-client-id",
        title: "Example PDF",
        authors: "",
        type: "Article",
        storageMode: "LOCAL",
        url: "file:///Users/josht/Downloads/example.pdf",
        canonicalUrl: "file:///Users/josht/Downloads/example.pdf",
        citationData: {
          title: "Example PDF",
          type: "article-journal",
          authors: [],
          url: "file:///Users/josht/Downloads/example.pdf",
        },
        metadataProvenance: {
          url: {
            value: "file:///Users/josht/Downloads/example.pdf",
            provider: "PDF_METADATA",
            confidence: "LOW",
            reviewed: false,
          },
        },
        localFile: {
          sha256: "a".repeat(64),
          filename: "example.pdf",
          fileSize: 1024,
          mimeType: "application/pdf",
        },
        projects: ["project-1"],
        tags: [],
      }),
    }));

    expect(response.status).toBe(201);
    expect(mocks.createSource).toHaveBeenCalledWith(
      "verified-user",
      expect.objectContaining({
        url: undefined,
        canonicalUrl: undefined,
        storageMode: "LOCAL",
        localFile: expect.objectContaining({ filename: "example.pdf" }),
      }),
    );
    expect(JSON.stringify(
      mocks.createSource.mock.calls[0]?.[1],
      (_key, value) => typeof value === "bigint" ? value.toString() : value,
    )).not.toContain("file:");
  });

  it("still rejects the same file URL for a WEB source", async () => {
    const response = await POST(new NextRequest("http://localhost/api/sources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Not a web source",
        type: "Website",
        storageMode: "WEB",
        url: "file:///Users/josht/Downloads/example.pdf",
        projects: ["project-1"],
        tags: [],
      }),
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "URL must use HTTP or HTTPS",
    });
    expect(mocks.createSource).not.toHaveBeenCalled();
  });
});
