import { describe, expect, it } from "vitest";
import {
  finalizeReviewedProvenance,
  needsMetadataReview,
  provenanceLabel,
  provenanceValue,
} from "@/lib/metadata/provenance";

const citation = {
  title: "Reviewed title",
  type: "article-journal",
  authors: [{ given: "Ada", family: "Lovelace" }],
  publisher: "Research Press",
  issued: { "date-parts": [[2026, 1, 2]] },
  url: "https://example.test/article",
};

describe("metadata provenance resolution", () => {
  it("marks only edited fields as user-reviewed and lets them win", () => {
    const result = finalizeReviewedProvenance(
      citation,
      {
        title: provenanceValue("Extracted title", "CROSSREF", "HIGH"),
        authors: provenanceValue(citation.authors, "CROSSREF", "HIGH"),
        publicationDate: provenanceValue(citation.issued, "CROSSREF", "HIGH"),
      },
      ["title"],
    );
    expect(result.provenance.title).toEqual({
      value: "Reviewed title",
      provider: "USER",
      confidence: "HIGH",
      reviewed: true,
    });
    expect(result.provenance.authors?.provider).toBe("CROSSREF");
    expect(provenanceLabel(result.provenance.title)).toBe("Manually confirmed");
  });

  it("derives review state from missing and weak important fields", () => {
    expect(needsMetadataReview({})).toBe(true);
    expect(
      needsMetadataReview({
        title: provenanceValue("URL title", "URL_INFERENCE", "LOW"),
        authors: provenanceValue(citation.authors, "JSON_LD", "MEDIUM"),
        publicationDate: provenanceValue(citation.issued, "JSON_LD", "MEDIUM"),
      }),
    ).toBe(true);
    expect(
      needsMetadataReview({
        title: provenanceValue("Title", "USER", "HIGH", true),
        authors: provenanceValue([], "USER", "HIGH", true),
        publisher: provenanceValue("", "USER", "HIGH", true),
        publicationDate: provenanceValue("", "USER", "HIGH", true),
      }),
    ).toBe(true);
  });

  it("marks manual-source values as reviewed when provenance is absent", () => {
    const result = finalizeReviewedProvenance(citation);
    expect(result.provenance.title?.provider).toBe("USER");
    expect(result.provenance.authors?.reviewed).toBe(true);
    expect(result.metadataNeedsReview).toBe(false);
  });
});
