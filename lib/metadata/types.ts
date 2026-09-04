import type { NormalizedCitationData } from "@/lib/citations/types";

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
  enrichedBy?: "crossref";
};

export type WebpageAnalysis = ResolvedSourceMetadata & {
  analysis: {
    status: AnalysisStatus;
    warnings: string[];
    retrieval: RetrievalDiagnostics;
    extraction: ExtractionDiagnostics;
  };
};
