import "server-only";
import { parseCitationName, toCitationDate } from "@/lib/citations/normalized";
import type { NormalizedCitationData } from "@/lib/citations/types";
import { ProviderCache, providerFailure, retryAfterSeconds } from "@/lib/metadata/providers/cache";
import type { IdentifierSet, MetadataEnrichmentProvider, MetadataProviderResult } from "@/lib/metadata/providers/types";

type Summary = {
  uid?: string; title?: string; authors?: Array<{ name?: string }>;
  pubdate?: string; fulljournalname?: string; source?: string; volume?: string;
  issue?: string; pages?: string; lang?: string[];
  articleids?: Array<{ idtype?: string; value?: string }>;
};

export class PubMedProvider implements MetadataEnrichmentProvider {
  readonly id = "PUBMED" as const;
  private readonly cache = new ProviderCache();
  constructor(private readonly fetcher?: typeof fetch) {}
  supports(input: IdentifierSet) { return Boolean(input.pmid || input.pmcid); }
  clearCache() { this.cache.clear(); }

  async enrich(input: IdentifierSet): Promise<MetadataProviderResult> {
    const id = input.pmid || input.pmcid;
    if (!id) return { provider: this.id, status: "NO_RECORD", candidate: null, cacheHit: false };
    const database = input.pmid ? "pubmed" : "pmc";
    const key = `${database}:${id.toUpperCase()}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    try {
      const params = new URLSearchParams({ db: database, id: id.replace(/^PMC/i, ""), retmode: "json", tool: "marginalia" });
      if (process.env.NCBI_API_KEY) params.set("api_key", process.env.NCBI_API_KEY);
      if (process.env.CROSSREF_MAILTO) params.set("email", process.env.CROSSREF_MAILTO);
      const response = await (this.fetcher ?? fetch)(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${params}`, {
        signal: AbortSignal.timeout(4_000), cache: "no-store",
        headers: { Accept: "application/json", "User-Agent": "Marginalia/1.0 metadata enrichment" },
      });
      if (response.status === 404)
        return this.cache.set(key, { provider: this.id, status: "NO_RECORD", candidate: null, cacheHit: false });
      if (response.status === 429)
        return this.cache.set(key, { provider: this.id, status: "RATE_LIMITED", candidate: null, cacheHit: false, retryAfter: retryAfterSeconds(response) });
      if (!response.ok) throw new Error(`PubMed returned ${response.status}`);
      const payload = (await response.json()) as { result?: Record<string, unknown> & { uids?: string[] } };
      const uid = payload.result?.uids?.[0];
      const summary = (uid ? payload.result?.[uid] : undefined) as Summary | undefined;
      if (!summary?.title)
        return this.cache.set(key, { provider: this.id, status: uid ? "MALFORMED" : "NO_RECORD", candidate: null, cacheHit: false });
      const articleId = (kind: string) => summary.articleids?.find((item) => item.idtype?.toLowerCase() === kind)?.value;
      const identifiers: IdentifierSet = {
        ...input, pmid: input.pmid ?? articleId("pubmed"),
        pmcid: input.pmcid ?? articleId("pmc"), doi: input.doi ?? articleId("doi"),
      };
      const data: NormalizedCitationData = {
        title: summary.title.replace(/\.$/, ""), type: "article-journal",
        authors: (summary.authors ?? []).map((author) => parseCitationName(author.name ?? "")).filter((author) => author.literal || author.given || author.family),
        containerTitle: summary.fulljournalname || summary.source, volume: summary.volume,
        issue: summary.issue, pages: summary.pages, issued: toCitationDate(summary.pubdate),
        doi: identifiers.doi, language: summary.lang?.[0],
        url: identifiers.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${identifiers.pmid}/` : `https://pmc.ncbi.nlm.nih.gov/articles/${identifiers.pmcid}/`,
      };
      return this.cache.set(key, { provider: this.id, status: "SUCCESS", cacheHit: false,
        candidate: { provider: this.id, confidence: "HIGH", data, identifiers, providerMetadata: { database, uid } } });
    } catch (error) { return this.cache.set(key, providerFailure(this.id, error)); }
  }
}
