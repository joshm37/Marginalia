import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeWebpage } from "@/lib/metadata/analyze-webpage";
import { clearCrossrefCache } from "@/lib/metadata/crossref";
import { clearProviderCaches } from "@/lib/metadata/providers/registry";
import { safeFetchHtml } from "@/lib/metadata/safe-fetch";

const publicUrl = "https://93.184.216.34/article";

afterEach(() => {
  clearCrossrefCache();
  clearProviderCaches();
  vi.unstubAllGlobals();
});

describe("safe webpage retrieval", () => {
  it("follows and records validated redirects", async () => {
    const mockedFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "/final" },
        }),
      )
      .mockResolvedValueOnce(
        new Response("<html><title>Final</title></html>", {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    const result = await safeFetchHtml(publicUrl, mockedFetch);
    expect(result.status).toBe("OK");
    expect(result.diagnostics).toMatchObject({
      finalUrl: "https://93.184.216.34/final",
      httpStatus: 200,
      redirectCount: 1,
      receivedHtml: true,
    });
  });

  it("classifies non-HTML responses", async () => {
    const result = await safeFetchHtml(
      publicUrl,
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response("PDF", {
          headers: { "content-type": "application/pdf" },
        }),
      ),
    );
    expect(result.status).toBe("NON_HTML");
    expect(result.diagnostics.receivedHtml).toBe(false);
  });

  it("preserves SSRF protection and identifies upstream blocking", async () => {
    const local = await safeFetchHtml(
      "http://127.0.0.1/private",
      vi.fn<typeof fetch>(),
    );
    expect(local.status).toBe("BLOCKED");

    const upstream = await safeFetchHtml(
      publicUrl,
      vi.fn<typeof fetch>().mockResolvedValue(new Response("Denied", { status: 403 })),
    );
    expect(upstream.status).toBe("BLOCKED");
    expect(upstream.diagnostics.failureReason).toContain("HTTP 403");
  });

  it.each([
    "http://user:password@example.com/private",
    "http://0.0.0.0/private",
    "http://192.0.2.1/private",
    "http://198.18.0.1/private",
    "http://203.0.113.1/private",
    "http://224.0.0.1/private",
    "http://[2001:db8::1]/private",
  ])("rejects unsafe or reserved destination %s", async (url) => {
    const mockedFetch = vi.fn<typeof fetch>();
    const result = await safeFetchHtml(url, mockedFetch);
    expect(result.status).toBe("BLOCKED");
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("revalidates a redirect before following it", async () => {
    const mockedFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } }),
    );
    const result = await safeFetchHtml(publicUrl, mockedFetch);
    expect(result.status).toBe("BLOCKED");
    expect(mockedFetch).toHaveBeenCalledOnce();
  });

  it("reports network failures without inventing HTML", async () => {
    const result = await safeFetchHtml(
      publicUrl,
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError("socket closed")),
    );
    expect(result.status).toBe("FETCH_FAILED");
    expect(result.diagnostics).toMatchObject({
      receivedHtml: false,
      responseSize: 0,
    });
    expect(result.warning).toContain("socket closed");
  });
});

describe("webpage analysis status", () => {
  it("marks a normal static article as successful", async () => {
    const html = `<html><head><title>Fallback title</title>
      <meta name="citation_title" content="Reliable extraction">
      <meta name="citation_author" content="Ada Lovelace">
      <meta name="citation_publication_date" content="2025-06-01">
      <meta name="citation_journal_title" content="Journal of Tests">
    </head></html>`;
    const result = await analyzeWebpage(
      publicUrl,
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(html, { headers: { "content-type": "text/html" } }),
      ),
    );
    expect(result.analysis.status).toBe("SUCCESS");
    expect(result.title).toBe("Reliable extraction");
    expect(result.analysis.extraction.citationMetaTags).toBe(4);
    expect(result.provenance.title).toMatchObject({
      provider: "HTML_CITATION_META",
      confidence: "HIGH",
      reviewed: false,
    });
    expect(result.metadataNeedsReview).toBe(false);
  });

  it("does not describe URL-only fallback as successful", async () => {
    const result = await analyzeWebpage(
      publicUrl,
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response("<html><body>Nothing useful</body></html>", {
          headers: { "content-type": "text/html" },
        }),
      ),
    );
    expect(result.analysis.status).toBe("NO_METADATA");
    expect(result.title).toBe("");
    expect(result.metadataNeedsReview).toBe(true);
    expect(result.analysis.warnings.join(" ")).toContain("did not contain usable");
  });

  it("uses a DOI in the submitted URL when webpage retrieval fails", async () => {
    const doiUrl = `${publicUrl}/10.5555/example-doi`;
    const globalFetch = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("https://api.crossref.org/")) {
        return new Response(
          JSON.stringify({
            message: {
              title: ["Authoritative DOI title"],
              author: [{ given: "Grace", family: "Hopper" }],
              issued: { "date-parts": [[2024, 2, 3]] },
              DOI: "10.5555/example-doi",
              type: "journal-article",
              "container-title": ["Computing"],
            },
          }),
          { headers: { "content-type": "application/json" } },
        );
      }
      throw new TypeError("publisher unavailable");
    });
    vi.stubGlobal("fetch", globalFetch);
    const result = await analyzeWebpage(doiUrl, globalFetch);
    expect(result.analysis.status).toBe("PARTIAL");
    expect(result.title).toBe("Authoritative DOI title");
    expect(result.analysis.extraction).toMatchObject({
      detectedDoi: "10.5555/example-doi",
      crossrefAttempted: true,
      crossrefSucceeded: true,
    });
    expect(result.analysis.retrieval.failureReason).toContain("publisher unavailable");
    expect(result.provenance.title).toMatchObject({
      provider: "CROSSREF",
      confidence: "HIGH",
    });
  });

  it("lets DOI metadata outrank conflicting webpage bibliographic fields", async () => {
    const globalFetch = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      if (String(input).startsWith("https://api.crossref.org/"))
        return new Response(
          JSON.stringify({
            message: {
              title: ["DOI title"],
              author: [{ given: "Verified", family: "Author" }],
              issued: { "date-parts": [[2025, 1, 2]] },
              DOI: "10.5555/conflict",
              type: "journal-article",
              "container-title": ["Verified Journal"],
            },
          }),
        );
      return new Response(
        `<meta name="citation_title" content="Webpage title">
         <meta name="citation_author" content="Web Author">
         <meta name="citation_doi" content="10.5555/conflict">
         <meta name="citation_journal_title" content="Web Journal">`,
        { headers: { "content-type": "text/html" } },
      );
    });
    vi.stubGlobal("fetch", globalFetch);
    const result = await analyzeWebpage(publicUrl, globalFetch);
    expect(result.title).toBe("DOI title");
    expect(result.containerTitle).toBe("Verified Journal");
    expect(result.provenance.title?.provider).toBe("CROSSREF");
    expect(result.provenance.containerTitle?.provider).toBe("CROSSREF");
  });

  it("keeps extracted metadata when Crossref fails", async () => {
    const globalFetch = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      if (String(input).startsWith("https://api.crossref.org/"))
        return new Response("Unavailable", { status: 503 });
      return new Response(
        `<meta name="citation_title" content="Publisher title">
         <meta name="citation_doi" content="10.5555/failure">`,
        { headers: { "content-type": "text/html" } },
      );
    });
    vi.stubGlobal("fetch", globalFetch);
    const result = await analyzeWebpage(publicUrl, globalFetch);
    expect(result.title).toBe("Publisher title");
    expect(result.analysis.status).toBe("PARTIAL");
    expect(result.analysis.extraction.crossrefSucceeded).toBe(false);
    expect(result.analysis.extraction.enrichmentProviders).toContainEqual(
      expect.objectContaining({ provider: "CROSSREF", status: "FAILED" }),
    );
    expect(result.analysis.warnings.join(" ")).not.toContain(
      "Crossref enrichment was unavailable",
    );
  });
});
