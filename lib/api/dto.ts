type SourceRecord = {
  id: string; title: string; authors: string | null; organization: string | null; publicationDate: Date | null;
  sourceType: string; url: string; description: string | null; notes: string | null; createdAt: Date;
  tags: { tag: { name: string } }[]; projects: { projectId: string }[];
};
type ProjectRecord = { id: string; name: string; description: string | null };
type AnnotationRecord = {
  id: string; sourceId: string; selectedText: string; note: string | null; annotationType: string; createdAt: Date;
  tags: { tag: { name: string } }[]; projects: { projectId: string }[];
};

const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();

export function sourceDto(value: SourceRecord) {
  return { id: value.id, title: value.title, authors: value.authors ?? '', organization: value.organization ?? '', date: value.publicationDate?.toISOString().slice(0, 10) ?? '', url: value.url, type: titleCase(value.sourceType), description: value.description ?? '', tags: value.tags.map(item => item.tag.name), projects: value.projects.map(item => item.projectId), notes: value.notes ?? '', createdAt: value.createdAt.toISOString().slice(0, 10) };
}
export function projectDto(value: ProjectRecord) { return { id: value.id, name: value.name, description: value.description ?? '' }; }
export function annotationDto(value: AnnotationRecord) {
  return { id: value.id, sourceId: value.sourceId, selectedText: value.selectedText, note: value.note ?? '', tags: value.tags.map(item => item.tag.name), projects: value.projects.map(item => item.projectId), type: titleCase(value.annotationType), createdAt: value.createdAt.toISOString().slice(0, 10) };
}
