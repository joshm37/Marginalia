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
  createdAt: Date;
  tags: { tag: { name: string } }[];
  projects: { projectId: string }[];
};
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
  return {
    id: value.id,
    title: value.title,
    authors: value.authors ?? "",
    organization: value.organization ?? "",
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
