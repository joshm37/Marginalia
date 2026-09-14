import "server-only";
import { normalizeDoi } from "@/lib/citations/identifiers";
import { toCitationDate } from "@/lib/citations/normalized";
import type { CitationName, NormalizedCitationData } from "@/lib/citations/types";
import { ProviderCache, providerFailure, retryAfterSeconds } from "@/lib/metadata/providers/cache";
import type { IdentifierSet, MetadataEnrichmentProvider, MetadataProviderResult } from "@/lib/metadata/providers/types";

type CrossrefPerson = { given?: string; family?: string; name?: string; suffix?: string };
type CrossrefWork = {
  title?: string[]; subtitle?: string[]; type?: string; author?: CrossrefPerson[];
  editor?: CrossrefPerson[]; translator?: CrossrefPerson[]; "container-title"?: string[];
  publisher?: string; "publisher-location"?: string; volume?: string; issue?: string;
  page?: string; edition?: string; DOI?: string; URL?: string; ISBN?: string[];
  ISSN?: string[]; language?: string; abstract?: string;
  issued?: { "date-parts"?: number[][] }; published?: { "date-parts"?: number[][] };
  created?: { "date-time"?: string };
};

const clean = (value?: string) => value?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const people = (values?: CrossrefPerson[]): CitationName[] =>
  (values ?? []).map((person) => ({
    ...(person.name ? { literal: person.name } : {}),
    ...(person.given ? { given: person.given } : {}),
    ...(person.family ? { family: person.family } : {}),
    ...(person.suffix ? { suffix: person.suffix } : {}),
  })).filter((person) => person.literal || person.family || person.given);
const cslType = (value?: string) => {
  if (value === "journal-article") return "article-journal";
  if (["book", "monograph", "edited-book"].includes(value ?? "")) return "book";
  if (value?.includes("report")) return "report";
  if (value === "proceedings-article") return "paper-conference";
  return "document";
};

export class CrossrefProvider implements MetadataEnrichmentProvider {
  readonly id = "CROSSREF" as const;
  private readonly cache = new ProviderCache();
  constructor(private readonly fetcher?: typeof fetch) {}
  supports(input: IdentifierSet) { return Boolean(normalizeDoi(input.doi)); }
  clearCache() { this.cache.clear(); }

  async enrich(input: IdentifierSet): Promise<MetadataProviderResult> {
    const doi = normalizeDoi(input.doi);
    if (!doi) return { provider: this.id, status: "NO_RECORD", candidate: null, cacheHit: false };
    const cached = this.cache.get(doi);
    if (cached) return cached;
    try {
      const mailto = process.env.CROSSREF_MAILTO;
      const query = mailto ? `?mailto=${encodeURIComponent(mailto)}` : "";
      const response = await (this.fetcher ?? fetch)(`https://api.crossref.org/works/${encodeURIComponent(doi)}${query}`, {
        signal: AbortSignal.timeout(4_000), cache: "no-store",
        headers: { Accept: "application/json", "User-Agent": `Marginalia/1.0 (metadata enrichment; mailto:${mailto ?? "support@example.invalid"})` },
      });
      if (response.status === 404)
        return this.cache.set(doi, { provider: this.id, status: "NO_RECORD", candidate: null, cacheHit: false });
      if (response.status === 429)
        return this.cache.set(doi, { provider: this.id, status: "RATE_LIMITED", candidate: null, cacheHit: false, retryAfter: retryAfterSeconds(response) });
      if (!response.ok) throw new Error(`Crossref returned ${response.status}`);
      const work = ((await response.json()) as { message?: CrossrefWork }).message;
      if (!work || !Array.isArray(work.title))
        return this.cache.set(doi, { provider: this.id, status: "MALFORMED", candidate: null, cacheHit: false });
      const issued = work.issued?.["date-parts"] ?? work.published?.["date-parts"];
      const data: NormalizedCitationData = {
        title: clean([...(work.title ?? []), ...(work.subtitle ?? [])].filter(Boolean).join(": ")) ?? "",
        type: cslType(work.type), authors: people(work.author), editors: people(work.editor),
        translators: people(work.translator), containerTitle: clean(work["container-title"]?.[0]),
        volume: work.volume, issue: work.issue, pages: work.page, edition: work.edition,
        publisher: clean(work.publisher), publisherPlace: clean(work["publisher-location"]),
        issued: issued?.length ? { "date-parts": issued } : toCitationDate(work.created?.["date-time"]),
        url: work.URL, doi, isbn: work.ISBN, issn: work.ISSN, language: work.language,
        abstract: clean(work.abstract),
      };
      if (!data.title)
        return this.cache.set(doi, { provider: this.id, status: "MALFORMED", candidate: null, cacheHit: false });
      return this.cache.set(doi, { provider: this.id, status: "SUCCESS", cacheHit: false,
        candidate: { provider: this.id, confidence: "HIGH", data, identifiers: { ...input, doi }, providerMetadata: { authority: "Crossref" } } });
    } catch (error) {
      return this.cache.set(doi, providerFailure(this.id, error));
    }
  }
}
