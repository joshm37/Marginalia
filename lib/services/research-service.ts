import type {
  CreateExcerptInput,
  CreateProjectInput,
} from "@/lib/repositories/contracts";
import { PrismaExcerptRepository } from "@/lib/repositories/prisma/annotation-repository";
import { PrismaProjectRepository } from "@/lib/repositories/prisma/project-repository";
import { PrismaSourceRepository } from "@/lib/repositories/prisma/source-repository";
import { PrismaTagRepository } from "@/lib/repositories/prisma/tag-repository";
import { SourceService } from "@/lib/services/source-service";

const projects = new PrismaProjectRepository();
const excerpts = new PrismaExcerptRepository();
const tags = new PrismaTagRepository();

export const researchService = {
  sources: new SourceService(new PrismaSourceRepository()),
  projects: {
    list: (userId: string) => projects.list(userId),
    listAll: (userId: string) => projects.listAll(userId),
    create: (userId: string, input: CreateProjectInput) =>
      projects.create(userId, input),
    updateState: (
      userId: string,
      projectId: string,
      input: {
        isActive?: boolean;
        deletedAt?: Date | null;
      },
    ) => projects.updateState(userId, projectId, input),
    deletePermanently: (userId: string, projectId: string) =>
      projects.deletePermanently(userId, projectId),
  },
  excerpts: {
    list: (userId: string) => excerpts.list(userId),
    create: (userId: string, input: CreateExcerptInput) =>
      excerpts.create(userId, input),
    update: (
      userId: string,
      excerptId: string,
      input: CreateExcerptInput,
    ) => excerpts.update(userId, excerptId, input),
    delete: (userId: string, excerptId: string) =>
      excerpts.delete(userId, excerptId),
  },
  tags: {
    list: (userId: string) => tags.list(userId),
  },
};
