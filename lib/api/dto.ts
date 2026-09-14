import { parseAuthorText } from "@/lib/citations/normalized";
import type { MetadataProvenance } from "@/lib/metadata/types";

type SourceRecord = {
  id: string;
  title: string;
  authors: string | null;
  organization: string | null;
  publicationDate: Date | null;
  sourceType: string;
  url: string | null;
  description: string | null;
  bibliographyAnnotation: string | null;
  includeInBibliography: boolean;
  notes: string | null;
  doi: string | null;
  citationMetadata: unknown;
  containerTitle: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  publisher: string | null;
  publisherPlace: string | null;
  edition: string | null;
  isbn: string | null;
  issn: string | null;
  accessedDate: Date | null;
  language: string | null;
  metadataNeedsReview: boolean;
  storageMode?: "WEB" | "LOCAL" | "ARCHIVED";
  localFile?: {
    sha256: string;
    filename: string;
    fileSize: bigint;
    mimeType: string;
    lastModified: Date | null;
  } | null;
  contributors: Array<{
    role: "AUTHOR" | "EDITOR" | "TRANSLATOR";
    sequence: number;
    contributor: StoredCitationName & { isLegacy: boolean };
  }>;
  createdAt: Date;
  tags: { tag: { name: string } }[];
  projects: { projectId: string }[];
};

type StoredCitationName = {
  given?: string;
  family?: string;
  literal?: string;
  suffix?: string;
};

function displayNames(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      const name = item as StoredCitationName;
      return (
        name.literal ||
        [name.given, name.family, name.suffix].filter(Boolean).join(" ")
      );
    })
    .filter(Boolean)
    .join(", ");
}

function citationDate(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const parts = (value as { "date-parts"?: number[][] })["date-parts"]?.[0];
  return parts
    ? [parts[0], parts[1]?.toString().padStart(2, "0"), parts[2]?.toString().padStart(2, "0")]
        .filter(Boolean)
        .join("-")
    : "";
}

type ProjectRecord = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  deletedAt: Date | null;
};
type ExcerptRecord = {
  id: string;
  sourceId: string;
  selectedText: string;
  surroundingText?: string | null;
  note: string | null;
  excerptType: string;
  createdAt: Date;
  locationData?: unknown;
  tags: { tag: { name: string } }[];
  projects: { projectId: string }[];
};

const titleCase = (value: string) =>
  value.charAt(0) + value.slice(1).toLowerCase();

export function sourceDto(value: SourceRecord) {
  const extras =
    value.citationMetadata && typeof value.citationMetadata === "object"
      ? (value.citationMetadata as Record<string, unknown>)
      : {};
  const metadataProvenance =
    extras.provenance && typeof extras.provenance === "object"
      ? (extras.provenance as MetadataProvenance)
      : {};
  const citationExtras = Object.fromEntries(
    Object.entries(extras).filter(([key]) => key !== "provenance"),
  );
  const relations = value.contributors ?? [];
  const people = (role: SourceRecord["contributors"][number]["role"]) =>
    relations
      .filter((item) => item.role === role)
      .sort((left, right) => left.sequence - right.sequence)
      .map((item) => ({
        ...(item.contributor.given ? { given: item.contributor.given } : {}),
        ...(item.contributor.family ? { family: item.contributor.family } : {}),
        ...(item.contributor.literal
          ? { literal: item.contributor.literal }
          : {}),
        ...(item.contributor.suffix
          ? { suffix: item.contributor.suffix }
          : {}),
      }));
  const hasLegacyAuthors = relations.some(
    (item) => item.role === "AUTHOR" && item.contributor.isLegacy,
  );
  const legacyNames = (key: "authors" | "editors" | "translators") =>
    Array.isArray(extras[key]) ? (extras[key] as StoredCitationName[]) : [];
  const authors = hasLegacyAuthors
    ? parseAuthorText(value.authors ?? "")
    : people("AUTHOR").length
      ? people("AUTHOR")
      : legacyNames("authors");
  const editors = people("EDITOR").length
    ? people("EDITOR")
    : legacyNames("editors");
  const translators = people("TRANSLATOR").length
    ? people("TRANSLATOR")
    : legacyNames("translators");
  const scalar = (column: string | null | undefined, key: string) =>
    column ?? (typeof extras[key] === "string" ? String(extras[key]) : undefined);
  const containerTitle = scalar(value.containerTitle, "containerTitle");
  const volume = scalar(value.volume, "volume");
  const issue = scalar(value.issue, "issue");
  const pages = scalar(value.pages, "pages");
  const publisher = scalar(value.publisher, "publisher") ?? value.organization ?? undefined;
  const publisherPlace = scalar(value.publisherPlace, "publisherPlace");
  const edition = scalar(value.edition, "edition");
  const citationData = {
    ...citationExtras,
    title: value.title,
    type:
      value.sourceType === "ARTICLE"
        ? "article-journal"
        : value.sourceType === "WEBSITE"
          ? "webpage"
          : value.sourceType.toLowerCase(),
    authors,
    editors,
    translators,
    containerTitle,
    volume,
    issue,
    pages,
    publisher,
    publisherPlace,
    edition,
    isbn: value.isbn?.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean),
    issn: value.issn?.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean),
    accessed: value.accessedDate
      ? {
          "date-parts": [[
            value.accessedDate.getUTCFullYear(),
            value.accessedDate.getUTCMonth() + 1,
            value.accessedDate.getUTCDate(),
          ]],
        }
      : undefined,
    language: value.language ?? undefined,
    issued: value.publicationDate
      ? {
          "date-parts": [[
            value.publicationDate.getUTCFullYear(),
            value.publicationDate.getUTCMonth() + 1,
            value.publicationDate.getUTCDate(),
          ]],
        }
      : undefined,
    url:
      value.url ??
      (typeof extras.bibliographicUrl === "string"
        ? extras.bibliographicUrl
        : undefined),
    doi: value.doi ?? undefined,
  };
  const contributors = relations.map((item) => ({
    role: item.role,
    sequence: item.sequence,
    ...(item.contributor.given ? { given: item.contributor.given } : {}),
    ...(item.contributor.family ? { family: item.contributor.family } : {}),
    ...(item.contributor.literal ? { literal: item.contributor.literal } : {}),
    ...(item.contributor.suffix ? { suffix: item.contributor.suffix } : {}),
  }));
  return {
    id: value.id,
    title: value.title,
    authors: authors.length ? displayNames(authors) : value.authors ?? "",
    organization: value.organization ?? "",
    publisher: publisher ?? "",
    doi: value.doi ?? "",
    containerTitle: containerTitle ?? "",
    volume: volume ?? "",
    issue: issue ?? "",
    pages: pages ?? "",
    editors: displayNames(editors),
    translators: displayNames(translators),
    edition: edition ?? "",
    publisherPlace: publisherPlace ?? "",
    isbn: value.isbn ?? (Array.isArray(extras.isbn) ? extras.isbn.join(", ") : ""),
    issn: value.issn ?? (Array.isArray(extras.issn) ? extras.issn.join(", ") : ""),
    accessedDate:
      value.accessedDate?.toISOString().slice(0, 10) ??
      citationDate(extras.accessed),
    language: value.language ?? (typeof extras.language === "string" ? extras.language : ""),
    citationData,
    metadataProvenance,
    metadataNeedsReview: value.metadataNeedsReview,
    contributors,
    date: value.publicationDate?.toISOString().slice(0, 10) ?? "",
    url: value.url ?? undefined,
    storageMode: value.storageMode,
    localFile: value.localFile
      ? {
          sha256: value.localFile.sha256,
          filename: value.localFile.filename,
          fileSize: Number(value.localFile.fileSize),
          mimeType: value.localFile.mimeType,
          ...(value.localFile.lastModified
            ? { lastModified: value.localFile.lastModified.toISOString() }
            : {}),
        }
      : undefined,
    type: titleCase(value.sourceType),
    description: value.description ?? "",
    bibliographyAnnotation: value.bibliographyAnnotation ?? "",
    includeInBibliography: value.includeInBibliography,
    tags: value.tags.map((item) => item.tag.name),
    projects: value.projects.map((item) => item.projectId),
    notes: value.notes ?? "",
    createdAt: value.createdAt.toISOString().slice(0, 10),
  };
}
export function projectDto(value: ProjectRecord) {
  return {
    id: value.id,
    name: value.name,
    description: value.description ?? "",
    isActive: value.isActive,
    deletedAt: value.deletedAt?.toISOString() ?? null,
  };
}
export function excerptDto(value: ExcerptRecord) {
  const location =
    value.locationData && typeof value.locationData === "object"
      ? (value.locationData as { pageNumber?: unknown })
      : undefined;
  return {
    id: value.id,
    sourceId: value.sourceId,
    selectedText: value.selectedText,
    surroundingText: value.surroundingText ?? "",
    note: value.note ?? "",
    tags: value.tags.map((item) => item.tag.name),
    projects: value.projects.map((item) => item.projectId),
    type: titleCase(value.excerptType),
    pageNumber:
      typeof location?.pageNumber === "string" && location.pageNumber
        ? location.pageNumber
        : undefined,
    locationData: location ?? undefined,
    createdAt: value.createdAt.toISOString().slice(0, 10),
  };
}
