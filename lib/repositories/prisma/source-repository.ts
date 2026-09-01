import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type {
  CreateSourceInput,
  SourceRepository,
} from "@/lib/repositories/contracts";

const sourceInclude = {
  projects: { include: { project: true } },
  tags: { include: { tag: true } },
  _count: { select: { excerpts: true } },
} satisfies Prisma.SourceInclude;

export class PrismaSourceRepository implements SourceRepository {
  list(userId: string) {
    return prisma.source.findMany({
      where: { userId },
      include: sourceInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  findDuplicate(
    userId: string,
    values: { doi?: string; canonicalUrl?: string; normalizedUrl: string },
  ) {
    const candidates = [
      values.doi ? { doi: values.doi } : undefined,
      values.canonicalUrl ? { canonicalUrl: values.canonicalUrl } : undefined,
      { normalizedUrl: values.normalizedUrl },
    ].filter(Boolean) as Prisma.SourceWhereInput[];

    return prisma.source.findFirst({
      where: { userId, OR: candidates },
      include: sourceInclude,
    });
  }

  async create(
    userId: string,
    input: CreateSourceInput & {
      normalizedUrl: string;
      normalizedDoi?: string;
    },
  ) {
    const ownedProjects = input.projectIds?.length
      ? await prisma.project.findMany({
          where: { userId, id: { in: input.projectIds }, deletedAt: null },
          select: { id: true },
        })
      : [];

    return prisma.source.create({
      data: {
        userId,
        title: input.title,
        authors: input.authors,
        organization: input.organization,
        publicationDate: input.publicationDate,
        sourceType: input.sourceType,
        url: input.url,
        canonicalUrl: input.canonicalUrl,
        normalizedUrl: input.normalizedUrl,
        doi: input.normalizedDoi,
        description: input.description,
        bibliographyAnnotation: input.bibliographyAnnotation,
        notes: input.notes,
        captureMethod: input.captureMethod,
        citationMetadata: input.citationMetadata as
          Prisma.InputJsonValue | undefined,
        projects: {
          create: ownedProjects.map((project) => ({ projectId: project.id })),
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
      include: sourceInclude,
    });
  }

  async delete(userId: string, sourceId: string) {
    const result = await prisma.source.deleteMany({
      where: { id: sourceId, userId },
    });
    return result.count > 0;
  }

  updateBibliographyAnnotation(
    userId: string,
    sourceId: string,
    input: { bibliographyAnnotation: string; includeInBibliography: boolean },
  ) {
    return prisma.source.update({
      where: { id: sourceId, userId },
      data: {
        bibliographyAnnotation: input.bibliographyAnnotation || null,
        includeInBibliography: input.includeInBibliography,
      },
      include: sourceInclude,
    });
  }

  async moveToProject(userId: string, sourceId: string, projectId: string) {
    const [source, project, sourceExcerpts] = await Promise.all([
      prisma.source.findFirst({
        where: { id: sourceId, userId },
        select: { id: true },
      }),
      prisma.project.findFirst({
        where: { id: projectId, userId, deletedAt: null },
        select: { id: true },
      }),
      prisma.excerpt.findMany({
        where: { sourceId, userId },
        select: { id: true },
      }),
    ]);
    if (!source || !project) return null;

    const excerptIds = sourceExcerpts.map((excerpt) => excerpt.id);
    const sourceMoves = [
      prisma.projectSource.deleteMany({ where: { sourceId } }),
      prisma.projectSource.create({ data: { sourceId, projectId } }),
    ];
    if (excerptIds.length)
      await prisma.$transaction([
        ...sourceMoves,
        prisma.excerptProject.deleteMany({
          where: { excerptId: { in: excerptIds } },
        }),
        prisma.excerptProject.createMany({
          data: excerptIds.map((excerptId) => ({
            excerptId,
            projectId,
          })),
        }),
      ]);
    else await prisma.$transaction(sourceMoves);

    return prisma.source.findUnique({
      where: { id: sourceId },
      include: sourceInclude,
    });
  }

  async update(
    userId: string,
    sourceId: string,
    input: CreateSourceInput & { normalizedUrl: string },
  ) {
    const projectId = input.projectIds?.[0];
    if (!projectId) return null;
    const [source, project, sourceExcerpts] = await Promise.all([
      prisma.source.findFirst({
        where: { id: sourceId, userId },
        select: { id: true },
      }),
      prisma.project.findFirst({
        where: { id: projectId, userId, deletedAt: null },
        select: { id: true },
      }),
      prisma.excerpt.findMany({
        where: { sourceId, userId },
        select: { id: true },
      }),
    ]);
    if (!source || !project) return null;

    const tagNames = [
      ...new Set(
        input.tagNames
          ?.map((name) => name.trim().toLowerCase())
          .filter(Boolean) ?? [],
      ),
    ];
    const excerptIds = sourceExcerpts.map((excerpt) => excerpt.id);
    const updateSource = prisma.source.update({
      where: { id: sourceId, userId },
      data: {
        title: input.title,
        authors: input.authors || null,
        organization: input.organization || null,
        publicationDate: input.publicationDate || null,
        sourceType: input.sourceType,
        url: input.url,
        normalizedUrl: input.normalizedUrl,
        description: input.description || null,
        bibliographyAnnotation: input.bibliographyAnnotation || null,
        notes: input.notes || null,
        projects: {
          deleteMany: {},
          create: { projectId },
        },
        tags: {
          deleteMany: {},
          create: tagNames.map((name) => ({
            tag: {
              connectOrCreate: {
                where: { userId_name: { userId, name } },
                create: { userId, name },
              },
            },
          })),
        },
      },
      include: sourceInclude,
    });
    if (!excerptIds.length) {
      const [updated] = await prisma.$transaction([updateSource]);
      return updated;
    }
    const [updated] = await prisma.$transaction([
      updateSource,
      prisma.excerptProject.deleteMany({
        where: { excerptId: { in: excerptIds } },
      }),
      prisma.excerptProject.createMany({
        data: excerptIds.map((excerptId) => ({
          excerptId,
          projectId,
        })),
      }),
    ]);
    return updated;
  }
}
