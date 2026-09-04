export type SourceType =
  "Article" | "Report" | "Case" | "Bill" | "Book" | "Website";
export type AnnotationType =
  "Evidence" | "Summary" | "Question" | "Counterargument" | "Note";

export type Source = {
  id: string;
  title: string;
  authors: string;
  organization: string;
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
  citationData?: NormalizedCitationData;
  date: string;
  url: string;
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
  note: string;
  tags: string[];
  projects: string[];
  type: AnnotationType;
  pageNumber?: string;
  createdAt: string;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  deletedAt: string | null;
};
import type { NormalizedCitationData } from "@/lib/citations/types";
