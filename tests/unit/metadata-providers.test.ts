import { describe, expect, it, vi } from "vitest";
import { CrossrefProvider } from "@/lib/metadata/providers/crossref-provider";
import { OpenAlexProvider } from "@/lib/metadata/providers/openalex-provider";
import { OpenLibraryProvider } from "@/lib/metadata/providers/open-library-provider";
import { PubMedProvider } from "@/lib/metadata/providers/pubmed-provider";
import { enrichMetadata } from "@/lib/metadata/providers/registry";
import { mergeMetadataCandidates } from "@/lib/metadata/providers/merge";
import type { MetadataEnrichmentProvider } from "@/lib/metadata/providers/types";

const response = (body: unknown, status = 200, headers?: HeadersInit) => new Response(JSON.stringify(body), { status, headers });

describe("metadata providers", () => {
  it("maps and caches PubMed summaries", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ result: { uids: ["42"], "42": { title: "Clinical result.", authors: [{ name: "Doe, Jane" }], fulljournalname: "Medical Journal", pubdate: "2024 Jan", articleids: [{ idtype: "doi", value: "10.1/test" }] } } }));
    const provider = new PubMedProvider(fetcher);
    expect((await provider.enrich({ pmid: "42" })).candidate?.data.title).toBe("Clinical result");
    expect((await provider.enrich({ pmid: "42" })).cacheHit).toBe(true);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("maps OpenAlex and Open Library records", async () => {
    const openAlex = new OpenAlexProvider(vi.fn().mockResolvedValue(response({ id: "https://openalex.org/W1", display_name: "A work", type: "article", authorships: [{ author: { display_name: "Ada Lovelace" } }], primary_location: { source: { display_name: "Journal" } }, publication_date: "2025-01-02" })));
    expect((await openAlex.enrich({ openAlexId: "W1" })).candidate?.provider).toBe("OPENALEX");
    const books = new OpenLibraryProvider(vi.fn().mockResolvedValue(response({ "ISBN:9781234567897": { title: "A book", authors: [{ name: "World Health Organization" }] } })));
    expect((await books.enrich({ isbn: ["9781234567897"] })).candidate?.data.type).toBe("book");
  });

  it.each([[404, "NO_RECORD"], [429, "RATE_LIMITED"]] as const)("handles Crossref status %s", async (status, expected) => {
    const provider = new CrossrefProvider(vi.fn().mockResolvedValue(response({}, status, status === 429 ? { "retry-after": "3" } : undefined)));
    expect((await provider.enrich({ doi: `10.5555/${status}` })).status).toBe(expected);
  });

  it("handles timeouts and malformed provider data without throwing", async () => {
    const timeout = Object.assign(new Error("late"), { name: "TimeoutError" });
    expect((await new PubMedProvider(vi.fn().mockRejectedValue(timeout)).enrich({ pmid: "1234" })).status).toBe("TIMEOUT");
    expect((await new OpenAlexProvider(vi.fn().mockResolvedValue(response({ id: "W1" }))).enrich({ openAlexId: "W1" })).status).toBe("MALFORMED");
  });
});

function mockProvider(id: MetadataEnrichmentProvider["id"], complete: boolean): MetadataEnrichmentProvider {
  return { id, supports: () => true, clearCache: vi.fn(), enrich: vi.fn().mockResolvedValue({ provider: id, status: complete ? "SUCCESS" : "NO_RECORD", cacheHit: false, candidate: complete ? { provider: id, confidence: "HIGH", identifiers: {}, data: { title: "Title", type: "article-journal", authors: [{ family: "Doe" }], containerTitle: "Journal" } } : null }) };
}

describe("provider selection and merging", () => {
  it("does not enrich an ordinary page without identifiers", async () => {
    const providers = [mockProvider("CROSSREF", true), mockProvider("PUBMED", true), mockProvider("ISBN_PROVIDER", true), mockProvider("OPENALEX", true)];
    expect((await enrichMetadata({}, providers)).selectedProviders).toEqual([]);
    providers.forEach((provider) => expect(provider.enrich).not.toHaveBeenCalled());
  });

  it("uses Crossref for a DOI and only falls back to OpenAlex when needed", async () => {
    const crossref = mockProvider("CROSSREF", true); const openAlex = mockProvider("OPENALEX", true);
    expect((await enrichMetadata({ doi: "10.1/x" }, [crossref, openAlex])).selectedProviders).toEqual(["CROSSREF"]);
    const missing = mockProvider("CROSSREF", false);
    expect((await enrichMetadata({ doi: "10.1/y" }, [missing, openAlex])).selectedProviders).toEqual(["CROSSREF", "OPENALEX"]);
  });

  it("preserves reviewed values and lets Crossref outrank OpenAlex", () => {
    const base = { title: "Manual", authors: [], organization: "", date: "", url: "https://example.com", type: "Website" as const, description: "", citationData: { title: "Manual", type: "webpage", authors: [], url: "https://example.com" }, provenance: { title: { value: "Manual", provider: "USER" as const, confidence: "HIGH" as const, reviewed: true } }, metadataNeedsReview: false };
    const merged = mergeMetadataCandidates(base, [
      { provider: "CROSSREF", confidence: "HIGH", identifiers: {}, data: { title: "Crossref", type: "article-journal", authors: [] } },
      { provider: "OPENALEX", confidence: "MEDIUM", identifiers: {}, data: { title: "OpenAlex", type: "article-journal", authors: [] } },
    ]);
    expect(merged.title).toBe("Manual");
  });
});
