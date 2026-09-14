import "server-only";
import { parseCitationName, toCitationDate } from "@/lib/citations/normalized";
import type { NormalizedCitationData } from "@/lib/citations/types";
import { ProviderCache, providerFailure, retryAfterSeconds } from "@/lib/metadata/providers/cache";
import type { IdentifierSet, MetadataEnrichmentProvider, MetadataProviderResult } from "@/lib/metadata/providers/types";

type OpenAlexWork = {
  id?: string; display_name?: string; type?: string; publication_date?: string; language?: string;
  doi?: string; ids?: { pmid?: string; pmcid?: string; openalex?: string };
  authorships?: Array<{ author?: { display_name?: string } }>;
  primary_location?: { landing_page_url?: string; source?: { display_name?: string } };
  biblio?: { volume?: string; issue?: string; first_page?: string; last_page?: string };
};

function lookupId(input: IdentifierSet) {
  if (input.openAlexId) return input.openAlexId;
  if (input.doi) return `https://doi.org/${input.doi}`;
  if (input.pmid) return `https://pubmed.ncbi.nlm.nih.gov/${input.pmid}`;
  if (input.pmcid) return `https://pmc.ncbi.nlm.nih.gov/articles/${input.pmcid}`;
}

export class OpenAlexProvider implements MetadataEnrichmentProvider {
  readonly id = "OPENALEX" as const;
  private readonly cache = new ProviderCache();
  constructor(private readonly fetcher?: typeof fetch) {}
  supports(input: IdentifierSet) { return Boolean(lookupId(input)); }
  clearCache() { this.cache.clear(); }

  async enrich(input: IdentifierSet): Promise<MetadataProviderResult> {
    const identifier = lookupId(input);
    if (!identifier) return { provider: this.id, status: "NO_RECORD", candidate: null, cacheHit: false };
    const key = identifier.toLowerCase();
    const cached = this.cache.get(key);
    if (cached) return cached;
    try {
      const url = new URL(`https://api.openalex.org/works/${encodeURIComponent(identifier)}`);
      if (process.env.OPENALEX_API_KEY) url.searchParams.set("api_key", process.env.OPENALEX_API_KEY);
      if (process.env.CROSSREF_MAILTO) url.searchParams.set("mailto", process.env.CROSSREF_MAILTO);
      const response = await (this.fetcher ?? fetch)(url, {
        signal: AbortSignal.timeout(4_000), cache: "no-store",
        headers: { Accept: "application/json", "User-Agent": "Marginalia/1.0 metadata enrichment" },
      });
      if (response.status === 404)
        return this.cache.set(key, { provider: this.id, status: "NO_RECORD", candidate: null, cacheHit: false });
      if (response.status === 429)
        return this.cache.set(key, { provider: this.id, status: "RATE_LIMITED", candidate: null, cacheHit: false, retryAfter: retryAfterSeconds(response) });
      if (!response.ok) throw new Error(`OpenAlex returned ${response.status}`);
      const work = (await response.json()) as OpenAlexWork;
      if (!work.display_name)
        return this.cache.set(key, { provider: this.id, status: "MALFORMED", candidate: null, cacheHit: false });
      const pages = [work.biblio?.first_page, work.biblio?.last_page].filter(Boolean).join("–") || undefined;
      const doi = work.doi?.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "") || input.doi;
      const data: NormalizedCitationData = {
        title: work.display_name, type: work.type === "article" ? "article-journal" : (work.type || "document"),
        authors: (work.authorships ?? []).map((item) => parseCitationName(item.author?.display_name ?? "")).filter((name) => name.literal || name.family || name.given),
        containerTitle: work.primary_location?.source?.display_name, issued: toCitationDate(work.publication_date),
        volume: work.biblio?.volume, issue: work.biblio?.issue, pages, language: work.language,
        doi, url: work.primary_location?.landing_page_url,
      };
      const identifiers: IdentifierSet = {
        ...input, doi,
        pmid: input.pmid ?? work.ids?.pmid?.match(/(\d+)\/?$/)?.[1],
        pmcid: input.pmcid ?? work.ids?.pmcid?.match(/(PMC\d+)\/?$/i)?.[1]?.toUpperCase(),
        openAlexId: input.openAlexId ?? (work.id || work.ids?.openalex)?.match(/(W\d+)\/?$/i)?.[1]?.toUpperCase(),
      };
      return this.cache.set(key, { provider: this.id, status: "SUCCESS", cacheHit: false,
        candidate: { provider: this.id, confidence: "MEDIUM", data, identifiers, providerMetadata: { openAlexId: identifiers.openAlexId } } });
    } catch (error) { return this.cache.set(key, providerFailure(this.id, error)); }
  }
}
