import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type {
  CreateSourceInput,
  SourceRepository,
} from "@/lib/repositories/contracts";
import { NotFoundError } from "@/lib/api/errors";

const sourceInclude = {
  projects: { include: { project: true } },
  tags: { include: { tag: true } },
  contributors: {
    include: { contributor: true },
    orderBy: [{ role: "asc" }, { sequence: "asc" }],
  },
  localFile: true,
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

  async listPage(
    userId: string,
    { skip, take, q, type, projectId, tag, reviewOnly, sort = "newest" }: { skip: number; take: number; q?: string; type?: string; projectId?: string; tag?: string; reviewOnly?: boolean; sort?: string },
  ) {
    const where: Prisma.SourceWhereInput = {
      userId,
      ...(type ? { sourceType: type.toUpperCase() as Prisma.EnumSourceTypeFilter["equals"] } : {}),
      ...(reviewOnly ? { metadataNeedsReview: true } : {}),
      ...(projectId ? { projects: { some: { projectId } } } : {}),
      ...(tag ? { tags: { some: { tag: { name: tag } } } } : {}),
      ...(q ? { OR: [
        { title: { contains: q, mode: "insensitive" } },
        { authors: { contains: q, mode: "insensitive" } },
        { organization: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { bibliographyAnnotation: { contains: q, mode: "insensitive" } },
        { tags: { some: { tag: { name: { contains: q, mode: "insensitive" } } } } },
      ] } : {}),
    };
    const orderBy: Prisma.SourceOrderByWithRelationInput =
      sort === "oldest" ? { createdAt: "asc" } :
      sort === "title" || sort === "project" || sort === "tag" ? { title: "asc" } :
      sort === "author" ? { authors: { sort: "asc", nulls: "last" } } :
      sort === "publication" ? { publicationDate: { sort: "desc", nulls: "last" } } :
      { createdAt: "desc" };
    const [rows, total] = await prisma.$transaction([
      prisma.source.findMany({
        where,
        include: sourceInclude,
        orderBy,
        skip,
        take,
      }),
      prisma.source.count({ where }),
    ]);
    return { rows, total };
  }

  async findDuplicate(
    userId: string,
    values: { doi?: string; canonicalUrl?: string; normalizedUrl?: string; localFileHash?: string },
  ) {
    // Separate lookups make the precedence deterministic rather than relying on
    // PostgreSQL's choice of row for an OR query.
    if (values.doi) {
      const match = await prisma.source.findFirst({ where: { userId, doi: values.doi }, include: sourceInclude });
      if (match) return match;
    }
    if (values.canonicalUrl) {
      const match = await prisma.source.findFirst({ where: { userId, canonicalUrl: values.canonicalUrl }, include: sourceInclude });
      if (match) return match;
    }
    if (values.normalizedUrl) {
      const match = await prisma.source.findFirst({ where: { userId, normalizedUrl: values.normalizedUrl }, include: sourceInclude });
      if (match) return match;
    }
    if (values.localFileHash) {
      return prisma.source.findFirst({
        where: { userId, localFile: { is: { sha256: values.localFileHash } } },
        include: sourceInclude,
      });
    }
    return null;
  }

  async create(
    userId: string,
    input: CreateSourceInput & {
      normalizedUrl: string;
      normalizedDoi?: string;
    },
  ) {
    const requestedProjectIds = [...new Set(input.projectIds ?? [])];
    const ownedProjects = requestedProjectIds.length
      ? await prisma.project.findMany({
          where: { userId, id: { in: requestedProjectIds }, deletedAt: null },
          select: { id: true },
        })
      : [];
    if (ownedProjects.length !== requestedProjectIds.length)
      throw new NotFoundError("Project not found");

    return prisma.source.create({
      data: {
        userId,
        title: input.title,
        authors: input.authors,
        organization: input.organization,
        publicationDate: input.publicationDate,
        sourceType: input.sourceType,
        url: input.storageMode === "LOCAL" ? null : input.url,
        canonicalUrl: input.storageMode === "LOCAL" ? null : input.canonicalUrl,
        normalizedUrl: input.normalizedUrl,
        doi: input.normalizedDoi,
        description: input.description,
        bibliographyAnnotation: input.bibliographyAnnotation,
        notes: input.notes,
        captureMethod: input.captureMethod,
        citationMetadata: input.citationMetadata as
          Prisma.InputJsonValue | undefined,
        containerTitle: input.containerTitle,
        volume: input.volume,
        issue: input.issue,
        pages: input.pages,
        publisher: input.publisher,
        publisherPlace: input.publisherPlace,
        edition: input.edition,
        isbn: input.isbn,
        issn: input.issn,
        accessedDate: input.accessedDate,
        language: input.language,
        metadataNeedsReview: input.metadataNeedsReview ?? false,
        storageMode: input.storageMode,
        ...(input.localFile
          ? {
              localFile: {
                create: {
                  sha256: input.localFile.sha256,
                  filename: input.localFile.filename,
                  fileSize: input.localFile.fileSize,
                  mimeType: input.localFile.mimeType,
                  lastModified: input.localFile.lastModified,
                },
              },
            }
          : {}),
        contributors: {
          create: (input.contributors ?? []).map((person) => ({
            role: person.role,
            sequence: person.sequence,
            contributor: {
              create: {
                userId,
                given: person.given,
                family: person.family,
                literal: person.literal,
                suffix: person.suffix,
              },
            },
          })),
        },
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
    const source = await prisma.source.findFirst({
      where: { id: sourceId, userId },
      select: { contributors: { select: { contributorId: true } } },
    });
    if (!source) return false;
    const [result] = await prisma.$transaction([
      prisma.source.deleteMany({ where: { id: sourceId, userId } }),
      prisma.contributor.deleteMany({
        where: {
          userId,
          id: { in: source.contributors.map((item) => item.contributorId) },
        },
      }),
    ]);
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

    return prisma.source.findFirst({
      where: { id: sourceId, userId },
      include: sourceInclude,
    });
  }

  async update(
    userId: string,
    sourceId: string,
    input: CreateSourceInput & { normalizedUrl?: string },
  ) {
    const projectId = input.projectIds?.[0];
    if (!projectId) return null;
    const [source, project, sourceExcerpts] = await Promise.all([
      prisma.source.findFirst({
        where: { id: sourceId, userId },
        select: {
          id: true,
          contributors: { select: { contributorId: true } },
        },
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
        url: input.storageMode === "LOCAL" ? null : input.url,
        canonicalUrl: input.storageMode === "LOCAL" ? null : input.canonicalUrl || null,
        normalizedUrl: input.storageMode === "LOCAL" ? null : input.normalizedUrl,
        doi: input.doi || null,
        description: input.description || null,
        bibliographyAnnotation: input.bibliographyAnnotation || null,
        notes: input.notes || null,
        citationMetadata: input.citationMetadata as
          | Prisma.InputJsonValue
          | undefined,
        containerTitle: input.containerTitle || null,
        volume: input.volume || null,
        issue: input.issue || null,
        pages: input.pages || null,
        publisher: input.publisher || null,
        publisherPlace: input.publisherPlace || null,
        edition: input.edition || null,
        isbn: input.isbn || null,
        issn: input.issn || null,
        accessedDate: input.accessedDate || null,
        language: input.language || null,
        metadataNeedsReview: input.metadataNeedsReview ?? false,
        storageMode: input.storageMode,
        ...(input.localFile
          ? {
              localFile: {
                upsert: {
                  create: {
                    sha256: input.localFile.sha256,
                    filename: input.localFile.filename,
                    fileSize: input.localFile.fileSize,
                    mimeType: input.localFile.mimeType,
                    lastModified: input.localFile.lastModified,
                  },
                  update: {
                    sha256: input.localFile.sha256,
                    filename: input.localFile.filename,
                    fileSize: input.localFile.fileSize,
                    mimeType: input.localFile.mimeType,
                    lastModified: input.localFile.lastModified ?? null,
                  },
                },
              },
            }
          : {}),
        contributors: {
          deleteMany: {},
          create: (input.contributors ?? []).map((person) => ({
            role: person.role,
            sequence: person.sequence,
            contributor: {
              create: {
                userId,
                given: person.given,
                family: person.family,
                literal: person.literal,
                suffix: person.suffix,
              },
            },
          })),
        },
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
    const oldContributorIds = source.contributors.map(
      (item) => item.contributorId,
    );
    const removeOldContributors = prisma.contributor.deleteMany({
      where: { id: { in: oldContributorIds }, userId },
    });
    if (!excerptIds.length) {
      const [updated] = await prisma.$transaction([
        updateSource,
        removeOldContributors,
      ]);
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
      removeOldContributors,
    ]);
    return updated;
  }
}
