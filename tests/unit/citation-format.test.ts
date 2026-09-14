import { describe, expect, it } from "vitest";
import { CitationJsEngine } from "@/lib/citations/citation-js-engine";
import {
  displayCitationNames,
  normalizedCitationToCsl,
  parseAuthorText,
  parseCitationName,
  sourceToNormalizedCitation,
} from "@/lib/citations/normalized";
import type { Source } from "@/lib/types";
import { citationStyles } from "@/lib/citations/style-registry";

const source: Source = {
  id: "source-1",
  title: "The Shape of Evidence",
  authors: "Ada Lovelace, Alan Turing",
  organization: "Research Quarterly",
  containerTitle: "Journal of Reliable Research",
  volume: "12",
  issue: "3",
  pages: "41-59",
  doi: "10.1234/evidence",
  date: "2026-04-12",
  url: "https://example.com/evidence",
  type: "Article",
  description: "",
  tags: [],
  projects: ["project-1"],
  notes: "",
  createdAt: "2026-04-12",
};

describe("structured citation names", () => {
  it("parses natural, inverted, suffixed, and institutional names", () => {
    expect(parseCitationName("Ada Lovelace")).toEqual({
      given: "Ada",
      family: "Lovelace",
    });
    expect(parseCitationName("King, Martin Luther, Jr.")).toEqual({
      family: "King",
      given: "Martin Luther",
      suffix: "Jr.",
    });
    expect(parseCitationName("World Health Organization")).toEqual({
      literal: "World Health Organization",
    });
    expect(
      displayCitationNames(parseAuthorText("Ada Lovelace\nAlan Turing")),
    ).toBe("Ada Lovelace, Alan Turing");
  });
});

describe("CSL mapping", () => {
  it("maps normalized source data into CSL-JSON fields", () => {
    const csl = normalizedCitationToCsl(
      sourceToNormalizedCitation(source),
      source.id,
    );
    expect(csl).toMatchObject({
      id: "source-1",
      type: "article-journal",
      title: "The Shape of Evidence",
      "container-title": "Journal of Reliable Research",
      volume: "12",
      issue: "3",
      page: "41-59",
      DOI: "10.1234/evidence",
      issued: { "date-parts": [[2026, 4, 12]] },
    });
    expect(csl.author).toEqual([
      { given: "Ada", family: "Lovelace" },
      { given: "Alan", family: "Turing" },
    ]);
  });

  it("restructures a manually corrected author instead of retaining stale enrichment", () => {
    const normalized = sourceToNormalizedCitation({
      ...source,
      authors: "Ursula Le Guin",
      citationData: {
        title: source.title,
        type: "article-journal",
        authors: [{ given: "Incorrect", family: "Author" }],
      },
    });
    expect(normalized.authors).toEqual([
      { given: "Ursula Le", family: "Guin" },
    ]);
  });
});

describe("Citation.js CSL formatting", () => {
  const engine = new CitationJsEngine();
  it.each([
    [
      "apa-7",
      "Lovelace, A., & Turing, A. (2026). The Shape of Evidence. Journal of Reliable Research, 12(3), 41–59. https://doi.org/10.1234/evidence",
    ],
    [
      "mla-9",
      "Lovelace, Ada, and Alan Turing. “The Shape of Evidence.” Journal of Reliable Research, vol. 12, no. 3, Apr. 2026, pp. 41–59, https://doi.org/10.1234/evidence.",
    ],
    [
      "chicago-notes",
      "Lovelace, Ada, and Alan Turing. “The Shape of Evidence.” Journal of Reliable Research 12, no. 3 (2026): 41–59. https://doi.org/10.1234/evidence.",
    ],
  ] as const)("formats %s through its CSL style", async (style, expected) => {
    expect(
      await engine.formatBibliography(sourceToNormalizedCitation(source), style),
    ).toBe(expected);
  });

  it.each(citationStyles)("formats realistic Unicode metadata with $name", async ({ id }) => {
    const citation = await engine.formatBibliography(sourceToNormalizedCitation({
      ...source,
      id: `unicode-${id}`,
      title: "Éthique et données scientifiques",
      authors: "World Health Organization\nJosé García\n李 明",
      date: "",
      type: id === "harvard" ? "Report" : "Article",
      citationData: { title: "Éthique et données scientifiques", type: "article-journal", authors: [{ literal: "World Health Organization" }, { given: "José", family: "García" }, { family: "李", given: "明" }] },
    }), id);
    expect(citation).toContain("Éthique");
    expect(citation.length).toBeGreaterThan(30);
  });

  it("formats a long bibliography without truncating entries", async () => {
    const records = Array.from({ length: 75 }, (_, index) => sourceToNormalizedCitation({ ...source, id: `long-${index}`, title: `Research record ${index + 1}` }));
    const entries = await engine.formatMany(records, "apa-7", records.map((_, index) => `long-${index}`));
    expect(entries).toHaveLength(75);
    expect(entries.at(-1)?.text).toContain("Research record 75");
  });

  it("formats a local PDF source without a fabricated filesystem URL", async () => {
    const citation = await engine.formatBibliography(sourceToNormalizedCitation({
      ...source,
      id: "local-pdf",
      storageMode: "LOCAL",
      url: undefined,
      title: "Research preserved on device",
      localFile: {
        sha256: "a".repeat(64),
        filename: "research.pdf",
        fileSize: 4096,
        mimeType: "application/pdf",
      },
    }), "apa-7");
    expect(citation).toContain("Research preserved on device");
    expect(citation).not.toContain("file://");
  });
});
