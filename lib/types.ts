export type SourceType = 'Article' | 'Report' | 'Case' | 'Bill' | 'Book' | 'Website';
export type AnnotationType = 'Quote' | 'Evidence' | 'Summary' | 'Question' | 'Counterargument' | 'Note';

export type Source = {
  id: string;
  title: string;
  authors: string;
  organization: string;
  date: string;
  url: string;
  type: SourceType;
  description: string;
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
  createdAt: string;
};

export type Project = { id: string; name: string; description: string; };
