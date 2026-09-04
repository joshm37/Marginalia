import type { Source, SourceType } from "@/lib/types";
import type {
  CitationDate,
  CitationName,
  CslJson,
  NormalizedCitationData,
} from "@/lib/citations/types";
import { normalizeDoi } from "@/lib/citations/identifiers";

const organizationWords =
  /\b(university|institute|association|organization|organisation|agency|department|committee|council|corporation|company|foundation|society|government|ministry|press)\b/i;

export function parseCitationName(raw: string): CitationName {
  const name = raw.trim();
  if (!name) return {};
  if (organizationWords.test(name)) return { literal: name };
  const inverted = name.match(/^([^,]+),\s*([^,]+?)(?:,\s*(.+))?$/);
  if (inverted)
    return {
      family: inverted[1].trim(),
      given: inverted[2].trim(),
      ...(inverted[3] ? { suffix: inverted[3].trim() } : {}),
    };
  const parts = name.split(/\s+/);
  if (parts.length === 1) return { literal: name };
  return { given: parts.slice(0, -1).join(" "), family: parts.at(-1) };
}

export function parseAuthorText(raw?: string): CitationName[] {
  if (!raw?.trim()) return [];
  let values: string[];
  if (/\n|;|\s+and\s+/i.test(raw)) values = raw.split(/\n+|\s*;\s*|\s+and\s+/i);
  else {
    const commaParts = raw.split(/\s*,\s*/);
    const isSuffixedInverted =
      commaParts.length === 3 &&
      /^(jr\.?|sr\.?|i{2,3}|iv)$/i.test(commaParts[2]);
    const isSimpleInverted =
      commaParts.length === 2 && commaParts[1].trim().split(/\s+/).length === 1;
    values = isSuffixedInverted || isSimpleInverted ? [raw] : commaParts;
  }
  return values.map(parseCitationName).filter(hasName);
}

export function displayCitationNames(names: CitationName[] = []) {
  return names
    .map(
      (name) =>
        name.literal ||
        [name.given, name.family, name.suffix].filter(Boolean).join(" "),
    )
    .filter(Boolean)
    .join(", ");
}

function hasName(name: CitationName) {
  return Boolean(name.literal || name.family || name.given);
}

export function toCitationDate(
  value?: string | Date | null,
): CitationDate | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return {
    "date-parts": [
      [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()],
    ],
  };
}

function cslType(type: SourceType | string) {
  const types: Record<string, string> = {
    Article: "article-journal",
    Report: "report",
    Case: "legal_case",
    Bill: "bill",
    Book: "book",
    Website: "webpage",
  };
  return types[type] ?? "document";
}

export function sourceToNormalizedCitation(
  source: Source,
): NormalizedCitationData {
  const saved = source.citationData;
  return {
    ...saved,
    title: source.title,
    type: cslType(source.type),
    authors:
      saved?.authors?.length &&
      displayCitationNames(saved.authors) === source.authors
        ? saved.authors
        : parseAuthorText(source.authors),
    publisher: source.organization || saved?.publisher,
    issued: toCitationDate(source.date) ?? saved?.issued,
    url: source.url || saved?.url,
    doi: normalizeDoi(source.doi || saved?.doi),
    containerTitle: source.containerTitle || saved?.containerTitle,
    volume: source.volume || saved?.volume,
    issue: source.issue || saved?.issue,
    pages: source.pages || saved?.pages,
    editors: source.editors ? parseAuthorText(source.editors) : saved?.editors,
    translators: source.translators
      ? parseAuthorText(source.translators)
      : saved?.translators,
    edition: source.edition || saved?.edition,
    publisherPlace: source.publisherPlace || saved?.publisherPlace,
    isbn: source.isbn
      ? source.isbn
          .split(/[,;\n]+/)
          .map((value) => value.trim())
          .filter(Boolean)
      : saved?.isbn,
    issn: source.issn
      ? source.issn
          .split(/[,;\n]+/)
          .map((value) => value.trim())
          .filter(Boolean)
      : saved?.issn,
    accessed: toCitationDate(source.accessedDate) ?? saved?.accessed,
  };
}

export function normalizeReviewedCitation(input: {
  title: string;
  type: SourceType;
  url: string;
  authors?: string;
  organization?: string;
  date?: string;
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
}) {
  return sourceToNormalizedCitation({
    ...input,
    id: "reviewed-source",
    authors: input.authors ?? "",
    organization: input.organization ?? "",
    date: input.date ?? "",
    description: "",
    notes: "",
    tags: [],
    projects: [],
    createdAt: "",
  });
}

export function normalizedCitationToCsl(
  data: NormalizedCitationData,
  id = "marginalia-source",
): CslJson {
  return compact({
    id,
    type: data.type,
    title: data.title,
    author: data.authors,
    editor: data.editors,
    translator: data.translators,
    "container-title": data.containerTitle,
    "collection-title": data.collectionTitle,
    volume: data.volume,
    issue: data.issue,
    page: data.pages,
    edition: data.edition,
    publisher: data.publisher,
    "publisher-place": data.publisherPlace,
    issued: data.issued,
    accessed: data.accessed,
    URL: data.url,
    DOI: data.doi,
    ISBN: data.isbn,
    ISSN: data.issn,
    language: data.language,
    abstract: data.abstract,
  }) as CslJson;
}

function compact(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => {
      if (item === undefined || item === null || item === "") return false;
      return !Array.isArray(item) || item.length > 0;
    }),
  );
}
