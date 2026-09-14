import { prisma } from "@/lib/db/prisma";
import type {
  CreateProjectInput,
  ProjectRepository,
} from "@/lib/repositories/contracts";

export class PrismaProjectRepository implements ProjectRepository {
  list(userId: string) {
    return prisma.project.findMany({
      where: { userId, deletedAt: null },
      include: { _count: { select: { sources: true, excerpts: true } } },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    });
  }

  listAll(userId: string) {
    return prisma.project.findMany({
      where: { userId, deletedAt: null },
      include: { _count: { select: { sources: true, excerpts: true } } },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    });
  }

  create(userId: string, input: CreateProjectInput) {
    return prisma.project.create({ data: { userId, ...input } });
  }

  updateState(
    userId: string,
    projectId: string,
    input: {
      isActive?: boolean;
      deletedAt?: Date | null;
    },
  ) {
    return prisma.project.update({
      where: {
        id: projectId,
        userId,
        ...(input.deletedAt === undefined ? { deletedAt: null } : {}),
      },
      data: input,
    });
  }

  async deletePermanently(userId: string, projectId: string) {
    const sourceFilter = {
      userId,
      projects: {
        some: {
          projectId,
          project: { userId, deletedAt: null, isActive: false },
        },
      },
    } as const;
    const sourceContributors = await prisma.sourceContributor.findMany({
      where: { source: sourceFilter },
      select: { contributorId: true },
    });
    const [, result] = await prisma.$transaction([
      prisma.source.deleteMany({
        where: sourceFilter,
      }),
      prisma.project.deleteMany({
        where: { id: projectId, userId, deletedAt: null, isActive: false },
      }),
      prisma.contributor.deleteMany({
        where: {
          userId,
          id: {
            in: sourceContributors.map((item) => item.contributorId),
          },
        },
      }),
    ]);
    return result.count > 0;
  }
}
