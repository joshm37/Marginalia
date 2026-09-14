import "server-only";
import { parseCitationName, toCitationDate } from "@/lib/citations/normalized";
import type { NormalizedCitationData } from "@/lib/citations/types";
import { ProviderCache, providerFailure, retryAfterSeconds } from "@/lib/metadata/providers/cache";
import type { IdentifierSet, MetadataEnrichmentProvider, MetadataProviderResult } from "@/lib/metadata/providers/types";

type OpenLibraryBook = {
  title?: string; subtitle?: string; url?: string; publish_date?: string; number_of_pages?: number;
  authors?: Array<{ name?: string }>; publishers?: Array<{ name?: string }>;
  publish_places?: Array<{ name?: string }>;
  identifiers?: { isbn_10?: string[]; isbn_13?: string[] };
};

export class OpenLibraryProvider implements MetadataEnrichmentProvider {
  readonly id = "ISBN_PROVIDER" as const;
  private readonly cache = new ProviderCache();
  constructor(private readonly fetcher?: typeof fetch) {}
  supports(input: IdentifierSet) { return Boolean(input.isbn?.length); }
  clearCache() { this.cache.clear(); }

  async enrich(input: IdentifierSet): Promise<MetadataProviderResult> {
    const isbn = input.isbn?.[0];
    if (!isbn) return { provider: this.id, status: "NO_RECORD", candidate: null, cacheHit: false };
    const cached = this.cache.get(isbn);
    if (cached) return cached;
    try {
      const key = `ISBN:${isbn}`;
      const url = new URL("https://openlibrary.org/api/books");
      url.search = new URLSearchParams({ bibkeys: key, jscmd: "data", format: "json" }).toString();
      const response = await (this.fetcher ?? fetch)(url, { signal: AbortSignal.timeout(4_000), cache: "no-store", headers: { Accept: "application/json", "User-Agent": "Marginalia/1.0 metadata enrichment" } });
      if (response.status === 404)
        return this.cache.set(isbn, { provider: this.id, status: "NO_RECORD", candidate: null, cacheHit: false });
      if (response.status === 429)
        return this.cache.set(isbn, { provider: this.id, status: "RATE_LIMITED", candidate: null, cacheHit: false, retryAfter: retryAfterSeconds(response) });
      if (!response.ok) throw new Error(`Open Library returned ${response.status}`);
      const book = ((await response.json()) as Record<string, OpenLibraryBook>)[key];
      if (!book) return this.cache.set(isbn, { provider: this.id, status: "NO_RECORD", candidate: null, cacheHit: false });
      if (!book.title) return this.cache.set(isbn, { provider: this.id, status: "MALFORMED", candidate: null, cacheHit: false });
      const allIsbn = [...(book.identifiers?.isbn_13 ?? []), ...(book.identifiers?.isbn_10 ?? []), isbn];
      const data: NormalizedCitationData = {
        title: [book.title, book.subtitle].filter(Boolean).join(": "), type: "book",
        authors: (book.authors ?? []).map((item) => parseCitationName(item.name ?? "")).filter((name) => name.literal || name.family || name.given),
        publisher: book.publishers?.[0]?.name, publisherPlace: book.publish_places?.[0]?.name,
        issued: toCitationDate(book.publish_date), url: book.url, isbn: [...new Set(allIsbn)],
      };
      return this.cache.set(isbn, { provider: this.id, status: "SUCCESS", cacheHit: false,
        candidate: { provider: this.id, confidence: "MEDIUM", data, identifiers: { ...input, isbn: data.isbn }, providerMetadata: { authority: "Open Library", numberOfPages: book.number_of_pages } } });
    } catch (error) { return this.cache.set(isbn, providerFailure(this.id, error)); }
  }
}
