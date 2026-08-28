import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type {
  CreateSourceInput,
  SourceRepository,
} from "@/lib/repositories/contracts";

const sourceInclude = {
  projects: { include: { project: true } },
  tags: { include: { tag: true } },
  _count: { select: { annotations: true } },
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
          where: { userId, id: { in: input.projectIds } },
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
}
