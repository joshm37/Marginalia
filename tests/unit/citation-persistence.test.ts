import { describe, expect, it } from "vitest";
import { citationPersistenceData } from "@/lib/citations/persistence";
import { sourceDto } from "@/lib/api/dto";
import { sourceToNormalizedCitation } from "@/lib/citations/normalized";
import { normalizedCitationToCsl } from "@/lib/citations/normalized";
import type { Source } from "@/lib/types";
import { citationFormatSchema } from "@/lib/api/schemas";

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: "source-1",
    title: "Structured research",
    authors: "Legacy Author",
    organization: "Research Press",
    publicationDate: new Date("2026-05-04T00:00:00.000Z"),
    sourceType: "ARTICLE",
    url: "https://example.test/research",
    description: null,
    bibliographyAnnotation: null,
    includeInBibliography: true,
    notes: null,
    doi: "10.1234/structured",
    citationMetadata: { collectionTitle: "Research Series", provider: "crossref" },
    containerTitle: "Journal of Structure",
    volume: "7",
    issue: "2",
    pages: "10-19",
    publisher: "Research Press",
    publisherPlace: "New York",
    edition: "2",
    isbn: "9780000000001",
    issn: "1234-5678",
    accessedDate: new Date("2026-06-01T00:00:00.000Z"),
    language: "en",
    metadataNeedsReview: false,
    contributors: [],
    createdAt: new Date("2026-05-04T00:00:00.000Z"),
    tags: [],
    projects: [],
    ...overrides,
  };
}

function relation(
  role: "AUTHOR" | "EDITOR" | "TRANSLATOR",
  sequence: number,
  contributor: Record<string, unknown>,
) {
  return { role, sequence, contributor: { isLegacy: false, ...contributor } };
}

describe("citation persistence mapping", () => {
  it("stores ordered authors, editors, translators, institutions, and suffixes relationally", () => {
    const persisted = citationPersistenceData({
      title: "Structured research",
      type: "article-journal",
      authors: [
        { given: "Jane", family: "Doe", suffix: "Jr." },
        { literal: "World Health Organization" },
      ],
      editors: [{ given: "Edith", family: "Editor" }],
      translators: [{ given: "Tara", family: "Translator" }],
      containerTitle: "Journal of Structure",
      abstract: "An uncommon CSL field retained as JSON.",
    }, {
      title: {
        value: "Structured research",
        provider: "CROSSREF",
        confidence: "HIGH",
        reviewed: false,
      },
    });

    expect(persisted.contributors).toEqual([
      expect.objectContaining({ role: "AUTHOR", sequence: 0, suffix: "Jr." }),
      expect.objectContaining({
        role: "AUTHOR",
        sequence: 1,
        literal: "World Health Organization",
      }),
      expect.objectContaining({ role: "EDITOR", sequence: 0 }),
      expect.objectContaining({ role: "TRANSLATOR", sequence: 0 }),
    ]);
    expect(persisted.citationMetadata).toEqual({
      abstract: "An uncommon CSL field retained as JSON.",
      provenance: {
        title: {
          value: "Structured research",
          provider: "CROSSREF",
          confidence: "HIGH",
          reviewed: false,
        },
      },
    });
  });

  it("maps relational contributors to CSL in sequence order", () => {
    const dto = sourceDto(
      record({
        contributors: [
          relation("AUTHOR", 1, { literal: "World Health Organization" }),
          relation("TRANSLATOR", 0, { given: "Tara", family: "Translator" }),
          relation("AUTHOR", 0, { given: "Jane", family: "Doe", suffix: "Jr." }),
          relation("EDITOR", 0, { given: "Edith", family: "Editor" }),
        ],
      }) as Parameters<typeof sourceDto>[0],
    );
    const csl = normalizedCitationToCsl(
      sourceToNormalizedCitation(dto as Source),
      dto.id,
    );

    expect(csl.author).toEqual([
      { given: "Jane", family: "Doe", suffix: "Jr." },
      { literal: "World Health Organization" },
    ]);
    expect(csl.editor).toEqual([{ given: "Edith", family: "Editor" }]);
    expect(csl.translator).toEqual([
      { given: "Tara", family: "Translator" },
    ]);
    expect(csl).toMatchObject({
      "container-title": "Journal of Structure",
      volume: "7",
      issue: "2",
      page: "10-19",
      publisher: "Research Press",
      "publisher-place": "New York",
      ISBN: ["9780000000001"],
      ISSN: ["1234-5678"],
      language: "en",
    });
    expect(dto.citationData).toMatchObject({
      title: "Structured research",
      type: "article-journal",
      url: "https://example.test/research",
      doi: "10.1234/structured",
      issued: { "date-parts": [[2026, 5, 4]] },
    });
    expect(
      citationFormatSchema.safeParse({ style: "apa-7", source: dto }).success,
    ).toBe(true);
  });

  it("keeps an ambiguous migrated author string renderable", () => {
    const dto = sourceDto(
      record({
        authors: "Doe, Jane and Smith, Alex",
        contributors: [
          {
            role: "AUTHOR",
            sequence: 0,
            contributor: {
              literal: "Doe, Jane and Smith, Alex",
              isLegacy: true,
            },
          },
        ],
      }) as Parameters<typeof sourceDto>[0],
    );

    expect(dto.authors).toBe("Jane Doe, Alex Smith");
    expect(dto.citationData.authors).toEqual([
      { family: "Doe", given: "Jane" },
      { family: "Smith", given: "Alex" },
    ]);
  });

  it("keeps a local source's genuine bibliographic webpage separate from its identity URL", () => {
    const persisted = citationPersistenceData({
      title: "Local paper",
      type: "article-journal",
      authors: [],
      url: "https://publisher.example/paper",
    }, undefined, { preserveCitationUrl: true });
    expect(persisted.citationMetadata).toEqual({
      bibliographicUrl: "https://publisher.example/paper",
    });

    const dto = sourceDto(record({
      storageMode: "LOCAL",
      url: null,
      citationMetadata: persisted.citationMetadata,
    }) as Parameters<typeof sourceDto>[0]);
    expect(dto.url).toBeUndefined();
    expect(dto.citationData.url).toBe("https://publisher.example/paper");
  });
});
