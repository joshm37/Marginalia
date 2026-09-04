export type CitationStyle = "APA" | "MLA" | "Chicago";

export type CitationName = {
  given?: string;
  family?: string;
  literal?: string;
  suffix?: string;
};

export type CitationDate = { "date-parts": number[][] };

export type NormalizedCitationData = {
  title: string;
  type: string;
  authors: CitationName[];
  editors?: CitationName[];
  translators?: CitationName[];
  containerTitle?: string;
  collectionTitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  edition?: string;
  publisher?: string;
  publisherPlace?: string;
  issued?: CitationDate;
  accessed?: CitationDate;
  url?: string;
  doi?: string;
  isbn?: string[];
  issn?: string[];
  language?: string;
  abstract?: string;
};

export type CslJson = Record<string, unknown> & {
  id: string;
  type: string;
  title: string;
};

export interface CitationEngine {
  formatBibliography(
    data: NormalizedCitationData,
    style: CitationStyle,
  ): string;
}
