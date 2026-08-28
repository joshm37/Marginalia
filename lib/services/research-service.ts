import type { CreateAnnotationInput, CreateProjectInput } from '@/lib/repositories/contracts';
import { PrismaAnnotationRepository } from '@/lib/repositories/prisma/annotation-repository';
import { PrismaProjectRepository } from '@/lib/repositories/prisma/project-repository';
import { PrismaSourceRepository } from '@/lib/repositories/prisma/source-repository';
import { SourceService } from '@/lib/services/source-service';

const projects = new PrismaProjectRepository();
const annotations = new PrismaAnnotationRepository();

export const researchService = {
  sources: new SourceService(new PrismaSourceRepository()),
  projects: {
    list: (userId: string) => projects.list(userId),
    create: (userId: string, input: CreateProjectInput) => projects.create(userId, input),
  },
  annotations: {
    list: (userId: string) => annotations.list(userId),
    create: (userId: string, input: CreateAnnotationInput) => annotations.create(userId, input),
  },
};
