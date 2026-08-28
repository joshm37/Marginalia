import { prisma } from '@/lib/db/prisma';
import type { CreateProjectInput, ProjectRepository } from '@/lib/repositories/contracts';

export class PrismaProjectRepository implements ProjectRepository {
  list(userId: string) {
    return prisma.project.findMany({
      where: { userId, archivedAt: null },
      include: { _count: { select: { sources: true, annotations: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  create(userId: string, input: CreateProjectInput) {
    return prisma.project.create({ data: { userId, ...input } });
  }
}
