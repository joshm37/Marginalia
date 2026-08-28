import type { AnnotationType, CaptureMethod, SourceType } from '@/lib/generated/prisma/enums';

export type CreateSourceInput = {
  title: string;
  authors?: string;
  organization?: string;
  publicationDate?: Date;
  sourceType: SourceType;
  url: string;
  canonicalUrl?: string;
  doi?: string;
  description?: string;
  notes?: string;
  captureMethod?: CaptureMethod;
  citationMetadata?: Record<string, unknown>;
  projectIds?: string[];
  tagNames?: string[];
};

export type CreateProjectInput = { name: string; description?: string; color?: string };

export type CreateAnnotationInput = {
  sourceId: string;
  selectedText: string;
  surroundingText?: string;
  note?: string;
  pageUrl: string;
  annotationType: AnnotationType;
  locationData?: Record<string, unknown>;
  projectIds?: string[];
  tagNames?: string[];
};

export interface SourceRepository {
  list(userId: string): Promise<unknown[]>;
  findDuplicate(userId: string, values: { doi?: string; canonicalUrl?: string; normalizedUrl: string }): Promise<unknown | null>;
  create(userId: string, input: CreateSourceInput & { normalizedUrl: string; normalizedDoi?: string }): Promise<unknown>;
  delete(userId: string, sourceId: string): Promise<boolean>;
}

export interface ProjectRepository {
  list(userId: string): Promise<unknown[]>;
  create(userId: string, input: CreateProjectInput): Promise<unknown>;
}

export interface AnnotationRepository {
  list(userId: string): Promise<unknown[]>;
  create(userId: string, input: CreateAnnotationInput): Promise<unknown>;
}
