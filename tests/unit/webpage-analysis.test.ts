import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeWebpage } from "@/lib/metadata/analyze-webpage";
import { clearCrossrefCache } from "@/lib/metadata/crossref";
import { safeFetchHtml } from "@/lib/metadata/safe-fetch";

const publicUrl = "https://93.184.216.34/article";

afterEach(() => {
  clearCrossrefCache();
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
    expect(result.analysis.warnings.join(" ")).toContain("Crossref enrichment was unavailable");
  });
});
