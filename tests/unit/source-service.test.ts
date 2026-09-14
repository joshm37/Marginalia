import { describe, expect, it, vi } from "vitest";
import type { SourceRepository } from "@/lib/repositories/contracts";
import {
  normalizeDoi,
  normalizeUrl,
  SourceService,
} from "@/lib/services/source-service";
import { SourceStorageMode, SourceType } from "@/lib/generated/prisma/enums";
import { detectDoi } from "@/lib/citations/identifiers";

function repository(
  overrides: Partial<SourceRepository> = {},
): SourceRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    listPage: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    findDuplicate: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: "source-1" }),
    moveToProject: vi.fn().mockResolvedValue(null),
    updateBibliographyAnnotation: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
}

describe("source normalization", () => {
  it("normalizes DOI prefixes and casing", () => {
    expect(normalizeDoi(" DOI: 10.1000/ABC.Def ")).toBe("10.1000/abc.def");
    expect(normalizeDoi("https://doi.org/10.5555/TEST")).toBe("10.5555/test");
    expect(normalizeDoi("   ")).toBeUndefined();
  });

  it("detects DOI values in URLs and structured identifier objects", () => {
    expect(detectDoi("https://doi.org/10.1000/ABC.Def")).toBe(
      "10.1000/abc.def",
    );
    expect(
      detectDoi({ propertyID: "DOI", value: "doi:10.5555/Structured" }),
    ).toBe("10.5555/structured");
  });

  it("normalizes hosts, tracking parameters, fragments, and query ordering", () => {
    expect(
      normalizeUrl(
        "HTTPS://Example.COM/article/?utm_source=newsletter&b=2&a=1#results",
      ),
    ).toBe("https://example.com/article?a=1&b=2");
  });
});

describe("SourceService", () => {
  it("checks normalized DOI, canonical URL, and URL", async () => {
    const findDuplicate = vi.fn().mockResolvedValue(null);
    const service = new SourceService(repository({ findDuplicate }));
    await service.checkDuplicate("user-1", {
      doi: "DOI: 10.1/ABC",
      canonicalUrl: "https://EXAMPLE.com/story/?utm_medium=email",
      url: "https://example.com/story?utm_source=test",
    });
    expect(findDuplicate).toHaveBeenCalledWith("user-1", {
      doi: "10.1/abc",
      canonicalUrl: "https://example.com/story",
      normalizedUrl: "https://example.com/story",
    });
  });

  it("returns the existing record through a typed duplicate error", async () => {
    const existing = { id: "existing" };
    const service = new SourceService(
      repository({ findDuplicate: vi.fn().mockResolvedValue(existing) }),
    );
    await expect(
      service.create("user-1", {
        title: "A source",
        url: "https://example.com",
        sourceType: SourceType.ARTICLE,
        projectIds: ["project-1"],
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      existingSource: existing,
    });
  });

  it("creates a local source without inventing a URL and normalizes its hash", async () => {
    const create = vi.fn().mockResolvedValue({ id: "local-1" });
    const findDuplicate = vi.fn().mockResolvedValue(null);
    const service = new SourceService(repository({ create, findDuplicate }));
    const hash = "A".repeat(64);
    await service.create("user-1", {
      title: "Local paper",
      sourceType: SourceType.ARTICLE,
      storageMode: SourceStorageMode.LOCAL,
      localFile: {
        sha256: hash,
        filename: "paper.pdf",
        fileSize: BigInt(2048),
        mimeType: "application/pdf",
      },
      projectIds: ["project-1"],
    });
    expect(findDuplicate).toHaveBeenCalledWith("user-1", {
      doi: undefined,
      canonicalUrl: undefined,
      normalizedUrl: undefined,
      localFileHash: hash.toLowerCase(),
    });
    expect(create).toHaveBeenCalledWith("user-1", expect.objectContaining({
      url: undefined,
      canonicalUrl: undefined,
      normalizedUrl: undefined,
      storageMode: SourceStorageMode.LOCAL,
      localFile: expect.objectContaining({ sha256: hash.toLowerCase() }),
    }));
  });

  it("cannot persist local file references when called below API validation", async () => {
    const create = vi.fn().mockResolvedValue({ id: "local-1" });
    const service = new SourceService(repository({ create }));
    await service.create("user-1", {
      title: "Local paper",
      sourceType: SourceType.ARTICLE,
      storageMode: SourceStorageMode.LOCAL,
      url: "file:///Users/name/Downloads/paper.pdf",
      canonicalUrl: "file:///Users/name/Downloads/paper.pdf",
      citationMetadata: {
        originalUrl: "file:///Users/name/Downloads/paper.pdf",
        provider: { path: "/Users/name/Downloads/paper.pdf" },
      },
      localFile: {
        sha256: "a".repeat(64),
        filename: "paper.pdf",
        fileSize: BigInt(10),
        mimeType: "application/pdf",
      },
      projectIds: ["project-1"],
    });
    const persisted = create.mock.calls[0]?.[1];
    expect(persisted).toMatchObject({
      url: undefined,
      canonicalUrl: undefined,
      normalizedUrl: undefined,
    });
    expect(JSON.stringify(persisted.citationMetadata)).not.toContain("/Users/name");
  });

  it("rejects a file URL for WEB sources even when called below API validation", async () => {
    const service = new SourceService(repository());
    await expect(service.create("user-1", {
      title: "Bad web source",
      sourceType: SourceType.WEBSITE,
      url: "file:///Users/name/Downloads/paper.pdf",
      projectIds: ["project-1"],
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects missing local metadata and preserves the web URL requirement", async () => {
    const service = new SourceService(repository());
    await expect(service.create("user-1", {
      title: "Missing file",
      sourceType: SourceType.ARTICLE,
      storageMode: SourceStorageMode.LOCAL,
      projectIds: ["project-1"],
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(service.create("user-1", {
      title: "Missing URL",
      sourceType: SourceType.WEBSITE,
      projectIds: ["project-1"],
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
