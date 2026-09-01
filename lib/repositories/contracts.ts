import type {
  ExcerptType,
  CaptureMethod,
  SourceType,
} from "@/lib/generated/prisma/enums";

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
  bibliographyAnnotation?: string;
  notes?: string;
  captureMethod?: CaptureMethod;
  citationMetadata?: Record<string, unknown>;
  projectIds?: string[];
  tagNames?: string[];
};

export type CreateProjectInput = {
  name: string;
  description?: string;
  color?: string;
};

export type CreateExcerptInput = {
  sourceId: string;
  selectedText: string;
  surroundingText?: string;
  note?: string;
  pageUrl: string;
  excerptType: ExcerptType;
  locationData?: Record<string, unknown>;
  projectIds?: string[];
  tagNames?: string[];
};

export interface SourceRepository {
  list(userId: string): Promise<unknown[]>;
  findDuplicate(
    userId: string,
    values: { doi?: string; canonicalUrl?: string; normalizedUrl: string },
  ): Promise<unknown | null>;
  create(
    userId: string,
    input: CreateSourceInput & {
      normalizedUrl: string;
      normalizedDoi?: string;
    },
  ): Promise<unknown>;
  moveToProject(
    userId: string,
    sourceId: string,
    projectId: string,
  ): Promise<unknown | null>;
  updateBibliographyAnnotation(
    userId: string,
    sourceId: string,
    input: { bibliographyAnnotation: string; includeInBibliography: boolean },
  ): Promise<unknown | null>;
  update(
    userId: string,
    sourceId: string,
    input: CreateSourceInput & { normalizedUrl: string },
  ): Promise<unknown | null>;
  delete(userId: string, sourceId: string): Promise<boolean>;
}

export interface ProjectRepository {
  list(userId: string): Promise<unknown[]>;
  listAll(userId: string): Promise<unknown[]>;
  create(userId: string, input: CreateProjectInput): Promise<unknown>;
  updateState(
    userId: string,
    projectId: string,
    input: {
      isActive?: boolean;
      deletedAt?: Date | null;
    },
  ): Promise<unknown>;
  deletePermanently(userId: string, projectId: string): Promise<boolean>;
}

export interface ExcerptRepository {
  list(userId: string): Promise<unknown[]>;
  create(userId: string, input: CreateExcerptInput): Promise<unknown>;
  update(
    userId: string,
    excerptId: string,
    input: CreateExcerptInput,
  ): Promise<unknown | null>;
  delete(userId: string, excerptId: string): Promise<boolean>;
}
