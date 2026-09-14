import { displayCitationNames } from "@/lib/citations/normalized";
import type { NormalizedCitationData } from "@/lib/citations/types";
import { citationValues, needsMetadataReview, provenanceValue } from "@/lib/metadata/provenance";
import type { MetadataField, MetadataProvider, ResolvedSourceMetadata } from "@/lib/metadata/types";
import type { MetadataCandidate } from "./types";

const authority: Record<MetadataProvider, number> = { USER: 100, CROSSREF: 90, PUBMED: 85, ISBN_PROVIDER: 80, OPENALEX: 70, HTML_CITATION_META: 60, JSON_LD: 55, PDF_METADATA: 52, DUBLIN_CORE: 50, PRISM: 50, OPEN_GRAPH: 40, HTML_GENERIC: 30, URL_INFERENCE: 10 };
const meaningful = (value: unknown) => Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== "";
const citationField: Record<string, MetadataField | undefined> = { title: "title", authors: "authors", editors: "editors", translators: "translators", publisher: "publisher", issued: "publicationDate", accessed: "accessedDate", containerTitle: "containerTitle", volume: "volume", issue: "issue", pages: "pages", edition: "edition", publisherPlace: "publisherPlace", doi: "doi", isbn: "isbn", issn: "issn", language: "language", abstract: "description", url: "url", type: "sourceType" };

export function mergeMetadataCandidates(base: ResolvedSourceMetadata, candidates: MetadataCandidate[]) {
  const resolved = structuredClone(base);
  const citation = { ...resolved.citationData } as NormalizedCitationData;
  for (const candidate of [...candidates].sort((a, b) => authority[a.provider] - authority[b.provider])) {
    const values = citationValues(candidate.data);
    for (const [field, value] of Object.entries(values) as Array<[MetadataField, unknown]>) {
      if (!meaningful(value)) continue;
      const current = resolved.provenance[field];
      if (current?.reviewed || authority[current?.provider ?? "URL_INFERENCE"] > authority[candidate.provider]) continue;
      resolved.provenance[field] = provenanceValue(value, candidate.provider, candidate.confidence);
    }
    for (const [key, value] of Object.entries(candidate.data)) {
      if (!meaningful(value)) continue;
      const current = citationField[key] ? resolved.provenance[citationField[key]!] : undefined;
      if (!current?.reviewed && authority[current?.provider ?? "URL_INFERENCE"] <= authority[candidate.provider])
        (citation as unknown as Record<string, unknown>)[key] = value;
    }
  }
  citation.url = base.canonicalUrl || base.url; citation.accessed = base.citationData.accessed;
  resolved.citationData = citation; resolved.title = citation.title || base.title;
  resolved.authors = citation.authors.map((author) => displayCitationNames([author])).filter(Boolean);
  resolved.organization = citation.publisher || base.organization;
  const parts = citation.issued?.["date-parts"]?.[0];
  resolved.date = parts ? parts.map((part, index) => index ? String(part).padStart(2, "0") : String(part)).join("-") : base.date;
  resolved.type = citation.type === "article-journal" ? "Article" : citation.type === "book" ? "Book" : citation.type === "report" ? "Report" : base.type;
  resolved.containerTitle = citation.containerTitle; resolved.volume = citation.volume; resolved.issue = citation.issue; resolved.pages = citation.pages; resolved.doi = citation.doi || base.doi;
  resolved.enrichedBy = [...new Set(candidates.map((candidate) => candidate.provider))];
  resolved.metadataNeedsReview = needsMetadataReview(resolved.provenance);
  return resolved;
}
