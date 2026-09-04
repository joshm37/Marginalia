type SourceRecord = {
  id: string;
  title: string;
  authors: string | null;
  organization: string | null;
  publicationDate: Date | null;
  sourceType: string;
  url: string;
  description: string | null;
  bibliographyAnnotation: string | null;
  includeInBibliography: boolean;
  notes: string | null;
  doi: string | null;
  citationMetadata: unknown;
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
    ? [
        parts[0],
        parts[1]?.toString().padStart(2, "0"),
        parts[2]?.toString().padStart(2, "0"),
      ]
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
  const citationData =
    value.citationMetadata && typeof value.citationMetadata === "object"
      ? (value.citationMetadata as Record<string, unknown>)
      : undefined;
  return {
    id: value.id,
    title: value.title,
    authors: value.authors ?? "",
    organization: value.organization ?? "",
    doi: value.doi ?? "",
    containerTitle:
      typeof citationData?.containerTitle === "string"
        ? citationData.containerTitle
        : "",
    volume: typeof citationData?.volume === "string" ? citationData.volume : "",
    issue: typeof citationData?.issue === "string" ? citationData.issue : "",
    pages: typeof citationData?.pages === "string" ? citationData.pages : "",
    editors: displayNames(citationData?.editors),
    translators: displayNames(citationData?.translators),
    edition:
      typeof citationData?.edition === "string" ? citationData.edition : "",
    publisherPlace:
      typeof citationData?.publisherPlace === "string"
        ? citationData.publisherPlace
        : "",
    isbn: Array.isArray(citationData?.isbn) ? citationData.isbn.join(", ") : "",
    issn: Array.isArray(citationData?.issn) ? citationData.issn.join(", ") : "",
    accessedDate: citationDate(citationData?.accessed),
    citationData,
    date: value.publicationDate?.toISOString().slice(0, 10) ?? "",
    url: value.url,
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
    note: value.note ?? "",
    tags: value.tags.map((item) => item.tag.name),
    projects: value.projects.map((item) => item.projectId),
    type: titleCase(value.excerptType),
    pageNumber:
      typeof location?.pageNumber === "string" && location.pageNumber
        ? location.pageNumber
        : undefined,
    createdAt: value.createdAt.toISOString().slice(0, 10),
  };
}
