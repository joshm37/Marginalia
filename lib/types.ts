import type { CitationName, NormalizedCitationData } from "@/lib/citations/types";
import type { MetadataField, MetadataProvenance } from "@/lib/metadata/types";

export type SourceType =
  "Article" | "Report" | "Case" | "Bill" | "Book" | "Website";
export type AnnotationType =
  "Evidence" | "Summary" | "Question" | "Counterargument" | "Note";

export type Source = {
  id: string;
  title: string;
  authors: string;
  organization: string;
  publisher?: string;
  doi?: string;
  containerTitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  editors?: string;
  translators?: string;
  edition?: string;
  publisherPlace?: string;
  isbn?: string;
  issn?: string;
  accessedDate?: string;
  language?: string;
  citationData?: NormalizedCitationData;
  metadataProvenance?: MetadataProvenance;
  metadataNeedsReview?: boolean;
  reviewedFields?: MetadataField[];
  contributors?: Array<CitationName & {
    role: "AUTHOR" | "EDITOR" | "TRANSLATOR";
    sequence: number;
  }>;
  date: string;
  url?: string;
  storageMode?: "WEB" | "LOCAL" | "ARCHIVED";
  localFile?: {
    sha256: string;
    filename: string;
    fileSize: number;
    mimeType: string;
    lastModified?: string;
  };
  type: SourceType;
  description: string;
  bibliographyAnnotation?: string;
  includeInBibliography?: boolean;
  tags: string[];
  projects: string[];
  notes: string;
  createdAt: string;
};

export type Annotation = {
  id: string;
  sourceId: string;
  selectedText: string;
  surroundingText?: string;
  note: string;
  tags: string[];
  projects: string[];
  type: AnnotationType;
  pageNumber?: string;
  locationData?: {
    version?: number;
    kind?: string;
    pageNumber?: string;
    exact?: string;
    prefix?: string;
    suffix?: string;
    textStart?: number;
    textEnd?: number;
    rect?: { x: number; y: number; width: number; height: number };
  };
  createdAt: string;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  deletedAt: string | null;
};
