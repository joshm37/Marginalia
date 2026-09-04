import { describe, expect, it } from "vitest";
import {
  extractHtmlMetadata,
  extractHtmlMetadataWithDiagnostics,
} from "@/lib/metadata/extract-html";

describe("webpage metadata extraction", () => {
  it("handles reversed attributes, mixed casing, canonical URLs, and scholarly fields", () => {
    const result = extractHtmlMetadata(
      `<!doctype html>
      <html><head>
        <meta content="A &amp; B: Reliable Research" name="citation_title">
        <meta content="Ada Lovelace" name="citation_author">
        <meta NAME="citation_author" CONTENT="Alan Turing">
        <meta content="Journal of Tests" name="citation_journal_title">
        <meta content="2026/04/12" name="citation_publication_date">
        <meta content="14" name="citation_volume">
        <meta content="2" name="citation_issue">
        <meta content="101" name="citation_firstpage">
        <meta content="119" name="citation_lastpage">
        <meta content="10.5555/EXAMPLE" name="citation_doi">
        <link href="/canonical-paper" REL="canonical alternate">
      </head></html>`,
      "https://publisher.example/raw?utm_source=test",
    );
    expect(result).toMatchObject({
      title: "A & B: Reliable Research",
      authors: ["Ada Lovelace", "Alan Turing"],
      type: "Article",
      date: "2026-04-12",
      canonicalUrl: "https://publisher.example/canonical-paper",
      doi: "10.5555/example",
      containerTitle: "Journal of Tests",
      volume: "14",
      issue: "2",
      pages: "101-119",
    });
  });

  it("extracts structured people and institutional authors from JSON-LD graphs", () => {
    const { metadata: result, diagnostics } = extractHtmlMetadataWithDiagnostics(
      `<script type="application/ld+json">{
        "@graph": [{
          "@type": "ScholarlyArticle",
          "headline": "Structured Article",
          "author": [
            {"@type":"Person","givenName":"James","familyName":"Baldwin"},
            {"@type":"Organization","name":"World Health Organization"}
          ],
          "publisher": {"name":"Evidence Press"},
          "datePublished":"2025-03-08"
        }]
      }</script>`,
      "https://example.org/article",
    );
    expect(result.authors).toEqual([
      "James Baldwin",
      "World Health Organization",
    ]);
    expect(result.citationData.authors).toEqual([
      { given: "James", family: "Baldwin", suffix: undefined },
      { literal: "World Health Organization" },
    ]);
    expect(diagnostics.jsonLdObjects).toBe(2);
  });

  it("reports which metadata families were actually present", () => {
    const { diagnostics } = extractHtmlMetadataWithDiagnostics(
      `<html><head><title>Plain title</title>
        <meta name="citation_title" content="Article title">
        <meta name="dc.creator" content="A. Writer">
        <meta property="og:site_name" content="Example">
        <meta name="prism.volume" content="2">
        <link rel="canonical" href="/article">
      </head></html>`,
      "https://example.org/input",
    );
    expect(diagnostics).toMatchObject({
      htmlTitle: "Plain title",
      citationMetaTags: 1,
      dublinCoreMetaTags: 1,
      openGraphMetaTags: 1,
      prismMetaTags: 1,
      canonicalUrl: "https://example.org/article",
    });
  });
});
