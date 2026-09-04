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
      "APA",
      "Lovelace, A., & Turing, A. (2026). The Shape of Evidence. Journal of Reliable Research, 12(3), 41–59. https://doi.org/10.1234/evidence",
    ],
    [
      "MLA",
      "Lovelace, Ada, and Alan Turing. “The Shape of Evidence.” Journal of Reliable Research, vol. 12, no. 3, Apr. 2026, pp. 41–59, https://doi.org/10.1234/evidence.",
    ],
    [
      "Chicago",
      "Lovelace, Ada, and Alan Turing. “The Shape of Evidence.” Journal of Reliable Research 12, no. 3 (2026): 41–59. https://doi.org/10.1234/evidence.",
    ],
  ] as const)("formats %s through its CSL style", (style, expected) => {
    expect(
      engine.formatBibliography(sourceToNormalizedCitation(source), style),
    ).toBe(expected);
  });
});
