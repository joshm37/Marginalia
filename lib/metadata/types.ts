import type { NormalizedCitationData } from "@/lib/citations/types";

export type MetadataProvider =
  | "USER"
  | "CROSSREF"
  | "HTML_CITATION_META"
  | "JSON_LD"
  | "DUBLIN_CORE"
  | "PRISM"
  | "OPEN_GRAPH"
  | "HTML_GENERIC"
  | "PDF_METADATA"
  | "URL_INFERENCE"
  | "PUBMED"
  | "OPENALEX"
  | "ISBN_PROVIDER";

export type MetadataConfidence = "HIGH" | "MEDIUM" | "LOW";

export type MetadataField =
  | "title"
  | "authors"
  | "editors"
  | "translators"
  | "publisher"
  | "publicationDate"
  | "accessedDate"
  | "containerTitle"
  | "volume"
  | "issue"
  | "pages"
  | "edition"
  | "publisherPlace"
  | "doi"
  | "isbn"
  | "issn"
  | "language"
  | "description"
  | "url"
  | "sourceType";

export type ProvenancedMetadataValue = {
  value: unknown;
  provider: MetadataProvider;
  confidence: MetadataConfidence;
  reviewed: boolean;
};

export type MetadataProvenance = Partial<
  Record<MetadataField, ProvenancedMetadataValue>
>;

export type AnalysisStatus =
  | "SUCCESS"
  | "PARTIAL"
  | "FETCH_FAILED"
  | "BLOCKED"
  | "NON_HTML"
  | "NO_METADATA";

export type RetrievalDiagnostics = {
  requestedUrl: string;
  finalUrl?: string;
  httpStatus?: number;
  contentType?: string;
  responseSize: number;
  redirectCount: number;
  failureReason?: string;
  receivedHtml: boolean;
  truncated: boolean;
};

export type ExtractionDiagnostics = {
  htmlTitle?: string;
  citationMetaTags: number;
  dublinCoreMetaTags: number;
  openGraphMetaTags: number;
  prismMetaTags: number;
  jsonLdObjects: number;
  canonicalUrl?: string;
  detectedDoi?: string;
  crossrefAttempted: boolean;
  crossrefSucceeded: boolean;
  enrichmentProviders?: Array<{ provider: MetadataProvider; status: string; cacheHit: boolean }>;
};

export type ResolvedSourceMetadata = {
  title: string;
  authors: string[];
  organization: string;
  date: string;
  url: string;
  canonicalUrl?: string;
  doi?: string;
  type: "Article" | "Report" | "Book" | "Website";
  description: string;
  containerTitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  citationData: NormalizedCitationData;
  enrichedBy?: MetadataProvider[];
  provenance: MetadataProvenance;
  metadataNeedsReview: boolean;
};

export type WebpageAnalysis = ResolvedSourceMetadata & {
  analysis: {
    status: AnalysisStatus;
    warnings: string[];
    retrieval: RetrievalDiagnostics;
    extraction: ExtractionDiagnostics;
  };
};
