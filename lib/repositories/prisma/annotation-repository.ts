import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type {
  CreateExcerptInput,
  ExcerptRepository,
} from "@/lib/repositories/contracts";
import { NotFoundError } from "@/lib/api/errors";

export class PrismaExcerptRepository implements ExcerptRepository {
  list(userId: string) {
    return prisma.excerpt.findMany({
      where: { userId },
      include: { projects: true, tags: { include: { tag: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async listPage(
    userId: string,
    { skip, take }: { skip: number; take: number },
  ) {
    const include = { projects: true, tags: { include: { tag: true } } };
    const [rows, total] = await prisma.$transaction([
      prisma.excerpt.findMany({
        where: { userId },
        include,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.excerpt.count({ where: { userId } }),
    ]);
    return { rows, total };
  }

  async create(userId: string, input: CreateExcerptInput) {
    const [source, projects] = await Promise.all([
      prisma.source.findFirst({
        where: { id: input.sourceId, userId },
        select: { id: true },
      }),
      input.projectIds?.length
        ? prisma.project.findMany({
            where: { userId, id: { in: input.projectIds }, deletedAt: null },
            select: { id: true },
          })
        : [],
    ]);
    if (!source) throw new NotFoundError("Source not found");
    if (projects.length !== new Set(input.projectIds ?? []).size)
      throw new NotFoundError("Project not found");

    return prisma.excerpt.create({
      data: {
        userId,
        sourceId: source.id,
        selectedText: input.selectedText,
        surroundingText: input.surroundingText,
        note: input.note,
        pageUrl: input.pageUrl,
        excerptType: input.excerptType,
        locationData: input.locationData as Prisma.InputJsonValue | undefined,
        projects: {
          create: projects.map((project) => ({ projectId: project.id })),
        },
        tags: {
          create: [
            ...new Set(
              input.tagNames
                ?.map((name) => name.trim().toLowerCase())
                .filter(Boolean) ?? [],
            ),
          ].map((name) => ({
            tag: {
              connectOrCreate: {
                where: { userId_name: { userId, name } },
                create: { userId, name },
              },
            },
          })),
        },
      },
      include: {
        projects: { include: { project: true } },
        tags: { include: { tag: true } },
      },
    });
  }

  async update(userId: string, excerptId: string, input: CreateExcerptInput) {
    const [excerpt, source, projects] = await Promise.all([
      prisma.excerpt.findFirst({
        where: { id: excerptId, userId },
        select: { id: true, locationData: true },
      }),
      prisma.source.findFirst({
        where: { id: input.sourceId, userId },
        select: { id: true },
      }),
      input.projectIds?.length
        ? prisma.project.findMany({
            where: { userId, id: { in: input.projectIds }, deletedAt: null },
            select: { id: true },
          })
        : [],
    ]);
    if (!excerpt || !source) return null;
    if (projects.length !== new Set(input.projectIds ?? []).size)
      throw new NotFoundError("Project not found");
    const oldLocation =
      excerpt.locationData && typeof excerpt.locationData === "object"
        ? (excerpt.locationData as Record<string, unknown>)
        : {};
    const locationData = { ...oldLocation, ...(input.locationData ?? {}) };
    return prisma.excerpt.update({
      where: { id: excerptId, userId },
      data: {
        sourceId: source.id,
        selectedText: input.selectedText,
        surroundingText: input.surroundingText,
        note: input.note || null,
        pageUrl: input.pageUrl,
        excerptType: input.excerptType,
        locationData: locationData as Prisma.InputJsonValue,
        projects: {
          deleteMany: {},
          create: projects.map((project) => ({ projectId: project.id })),
        },
        tags: {
          deleteMany: {},
          create: [
            ...new Set(
              input.tagNames
                ?.map((name) => name.trim().toLowerCase())
                .filter(Boolean) ?? [],
            ),
          ].map((name) => ({
            tag: {
              connectOrCreate: {
                where: { userId_name: { userId, name } },
                create: { userId, name },
              },
            },
          })),
        },
      },
      include: {
        projects: { include: { project: true } },
        tags: { include: { tag: true } },
      },
    });
  }

  async delete(userId: string, excerptId: string) {
    const result = await prisma.excerpt.deleteMany({
      where: { id: excerptId, userId },
    });
    return result.count > 0;
  }
}
