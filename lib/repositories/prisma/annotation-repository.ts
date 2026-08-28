import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type {
  AnnotationRepository,
  CreateAnnotationInput,
} from "@/lib/repositories/contracts";

export class PrismaAnnotationRepository implements AnnotationRepository {
  list(userId: string) {
    return prisma.annotation.findMany({
      where: { userId },
      include: { projects: true, tags: { include: { tag: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(userId: string, input: CreateAnnotationInput) {
    const [source, projects] = await Promise.all([
      prisma.source.findFirst({
        where: { id: input.sourceId, userId },
        select: { id: true },
      }),
      input.projectIds?.length
        ? prisma.project.findMany({
            where: { userId, id: { in: input.projectIds } },
            select: { id: true },
          })
        : [],
    ]);
    if (!source) throw new Error("Source not found");

    return prisma.annotation.create({
      data: {
        userId,
        sourceId: source.id,
        selectedText: input.selectedText,
        surroundingText: input.surroundingText,
        note: input.note,
        pageUrl: input.pageUrl,
        annotationType: input.annotationType,
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
}
