import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/api/errors";
import { PrismaExcerptRepository } from "@/lib/repositories/prisma/annotation-repository";
import { PrismaProjectRepository } from "@/lib/repositories/prisma/project-repository";
import { PrismaSourceRepository } from "@/lib/repositories/prisma/source-repository";
import {
  SourceService,
  DuplicateSourceError,
} from "@/lib/services/source-service";
import {
  CaptureMethod,
  ExcerptType,
  SourceStorageMode,
  SourceType,
} from "@/lib/generated/prisma/enums";

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const suite = enabled ? describe : describe.skip;
const runId = `integration-${Date.now()}`;
const users = {
  a: `${runId}-a`,
  b: `${runId}-b`,
};

suite("PostgreSQL repositories", () => {
  const projects = new PrismaProjectRepository();
  const sourceRepository = new PrismaSourceRepository();
  const sources = new SourceService(sourceRepository);
  const excerpts = new PrismaExcerptRepository();
  let projectA1: { id: string };
  let projectA2: { id: string };
  let projectB: { id: string };

  // Each case needs an empty workspace; security tests intentionally retain
  // foreign records to prove unauthorized mutations did not remove them.
  beforeEach(async () => {
    await prisma.user.createMany({
      data: [
        { id: users.a, email: `${users.a}@example.test` },
        { id: users.b, email: `${users.b}@example.test` },
      ],
    });
    projectA1 = await projects.create(users.a, { name: `${runId}-primary` });
    projectA2 = await projects.create(users.a, { name: `${runId}-secondary` });
    projectB = await projects.create(users.b, { name: `${runId}-foreign` });
  });

  afterEach(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: Object.values(users) } },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("allows reused emails without merging identities or project ownership", async () => {
    const email = `${runId}-shared@example.test`;
    for (const id of [users.a, users.b, users.b]) {
      await prisma.user.upsert({
        where: { id },
        create: { id, email },
        update: { email },
      });
    }
    expect(await prisma.user.count({ where: { email } })).toBe(2);
    expect((await projects.listAll(users.a)).map((p) => p.id)).toContain(projectA1.id);
    expect((await projects.listAll(users.b)).map((p) => p.id)).not.toContain(projectA1.id);
  });

  it("isolates user data and rejects a foreign project", async () => {
    await expect(
      sources.create(users.a, {
        title: "Foreign project attempt",
        url: `https://example.test/${runId}/foreign`,
        sourceType: SourceType.ARTICLE,
        projectIds: [projectB.id],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(sources.list(users.b)).resolves.toHaveLength(0);
  });

  it("rejects cross-user source, excerpt, and project mutations", async () => {
    const foreignSource = (await sources.create(users.b, {
      title: "Foreign source",
      url: `https://example.test/${runId}/foreign-source`,
      sourceType: SourceType.ARTICLE,
      projectIds: [projectB.id],
    })) as { id: string };
    const foreignExcerpt = (await excerpts.create(users.b, {
      sourceId: foreignSource.id,
      selectedText: "Foreign evidence",
      pageUrl: `https://example.test/${runId}/foreign-source`,
      excerptType: ExcerptType.EVIDENCE,
      projectIds: [projectB.id],
    })) as { id: string };

    await expect(sourceRepository.delete(users.a, foreignSource.id)).resolves.toBe(false);
    await expect(excerpts.delete(users.a, foreignExcerpt.id)).resolves.toBe(false);
    await expect(
      excerpts.create(users.a, {
        sourceId: foreignSource.id,
        selectedText: "Attempted association",
        pageUrl: `https://example.test/${runId}/foreign-source`,
        excerptType: ExcerptType.NOTE,
        projectIds: [projectA1.id],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      sourceRepository.moveToProject(users.a, foreignSource.id, projectA1.id),
    ).resolves.toBeNull();
    await expect(
      projects.updateState(users.a, projectB.id, { isActive: false }),
    ).rejects.toMatchObject({ code: "P2025" });

    await expect(
      prisma.source.findUnique({ where: { id: foreignSource.id } }),
    ).resolves.toMatchObject({ userId: users.b });
    await expect(
      prisma.excerpt.findUnique({ where: { id: foreignExcerpt.id } }),
    ).resolves.toMatchObject({ userId: users.b });
  });

  it("detects normalized duplicates and moves a source with its excerpts", async () => {
    const created = (await sources.create(users.a, {
      title: "Repository test source",
      url: `https://EXAMPLE.test/${runId}/paper/?utm_source=test`,
      doi: "DOI: 10.1234/TEST",
      sourceType: SourceType.ARTICLE,
      captureMethod: CaptureMethod.EXTENSION,
      projectIds: [projectA1.id],
      tagNames: ["Evidence"],
      citationMetadata: {
        provider: "integration-test",
        provenance: {
          title: {
            value: "Repository test source",
            provider: "CROSSREF",
            confidence: "HIGH",
            reviewed: false,
          },
        },
      },
      metadataNeedsReview: true,
      contributors: [
        {
          role: "AUTHOR",
          sequence: 0,
          given: "Ada",
          family: "Lovelace",
        },
      ],
      volume: "4",
    })) as { id: string };

    await expect(
      sources.create(users.a, {
        title: "Same paper",
        url: `https://different.test/${runId}`,
        doi: "https://doi.org/10.1234/test",
        sourceType: SourceType.ARTICLE,
        projectIds: [projectA1.id],
      }),
    ).rejects.toBeInstanceOf(DuplicateSourceError);

    const excerpt = (await excerpts.create(users.a, {
      sourceId: created.id,
      selectedText: "A durable test excerpt.",
      note: "Original note",
      pageUrl: `https://example.test/${runId}/paper`,
      excerptType: ExcerptType.EVIDENCE,
      projectIds: [projectA1.id],
      tagNames: ["Evidence"],
    })) as { id: string };

    const persisted = await prisma.source.findUnique({
      where: { id: created.id },
      include: {
        contributors: {
          include: { contributor: true },
          orderBy: { sequence: "asc" },
        },
      },
    });
    expect(persisted).toMatchObject({
      volume: "4",
      metadataNeedsReview: true,
      citationMetadata: {
        provider: "integration-test",
        provenance: { title: { provider: "CROSSREF" } },
      },
    });
    expect(persisted?.contributors[0]).toMatchObject({
      role: "AUTHOR",
      sequence: 0,
      contributor: { given: "Ada", family: "Lovelace" },
    });

    await expect(
      sourceRepository.moveToProject(users.b, created.id, projectB.id),
    ).resolves.toBeNull();
    await sourceRepository.moveToProject(users.a, created.id, projectA2.id);

    const moved = await prisma.excerptProject.findMany({
      where: { excerptId: excerpt.id },
    });
    expect(moved).toEqual([
      expect.objectContaining({ projectId: projectA2.id }),
    ]);
    await expect(sources.list(users.b)).resolves.toHaveLength(0);
  });

  it("stores local PDF identity per user and detects same-user duplicates", async () => {
    const hash = "b".repeat(64);
    const localInput = {
      title: "Local PDF source",
      sourceType: SourceType.ARTICLE,
      storageMode: SourceStorageMode.LOCAL,
      url: "file:///Users/test/Downloads/article.pdf",
      canonicalUrl: "file:///Users/test/Downloads/article.pdf",
      citationMetadata: {
        originalUrl: "file:///Users/test/Downloads/article.pdf",
        localPath: "/Users/test/Downloads/article.pdf",
      },
      localFile: {
        sha256: hash,
        filename: "article.pdf",
        fileSize: BigInt(8192),
        mimeType: "application/pdf",
        lastModified: new Date("2026-09-13T12:00:00.000Z"),
      },
    };
    const localA = (await sources.create(users.a, {
      ...localInput,
      projectIds: [projectA1.id],
    })) as { id: string; localFile: { sha256: string; fileSize: bigint } };
    expect(localA.localFile).toMatchObject({ sha256: hash, fileSize: BigInt(8192) });
    const persistedLocal = await prisma.source.findUnique({ where: { id: localA.id } });
    expect(persistedLocal).toMatchObject({
      url: null,
      canonicalUrl: null,
      normalizedUrl: null,
    });
    expect(JSON.stringify(persistedLocal?.citationMetadata)).not.toContain("/Users/test");

    await expect(sources.create(users.a, {
      ...localInput,
      title: "Duplicate local PDF",
      projectIds: [projectA1.id],
    })).rejects.toBeInstanceOf(DuplicateSourceError);

    const localB = (await sources.create(users.b, {
      ...localInput,
      title: "Other user's copy",
      projectIds: [projectB.id],
    })) as { id: string };
    expect(localB.id).not.toBe(localA.id);

    const localExcerpt = (await excerpts.create(users.a, {
      sourceId: localA.id,
      selectedText: "Text extracted later on the user's device.",
      excerptType: ExcerptType.EVIDENCE,
      projectIds: [projectA1.id],
      locationData: {
        version: 1,
        kind: "PDF_TEXT_QUOTE",
        pageNumber: "7",
        exact: "Text extracted later on the user's device.",
        prefix: "Before ",
        suffix: " After",
      },
    })) as { id: string };
    await expect(prisma.excerpt.findUnique({ where: { id: localExcerpt.id } }))
      .resolves.toMatchObject({
        pageUrl: null,
        userId: users.a,
        locationData: expect.objectContaining({ pageNumber: "7", prefix: "Before ", suffix: " After" }),
      });

    await expect(sourceRepository.update(users.b, localA.id, {
      ...localInput,
      normalizedUrl: undefined,
      projectIds: [projectB.id],
    })).resolves.toBeNull();
  });

  it("cascades source deletion to excerpts and project deletion to sources", async () => {
    const sourceDeleteProject = await projects.create(users.a, {
      name: `${runId}-source-delete`,
    });
    const directlyDeletedSource = (await sources.create(users.a, {
      title: "Source cascade test",
      url: `https://example.test/${runId}/source-cascade`,
      sourceType: SourceType.ARTICLE,
      projectIds: [sourceDeleteProject.id],
      contributors: [
        {
          role: "AUTHOR",
          sequence: 0,
          literal: "World Health Organization",
        },
      ],
    })) as {
      id: string;
      contributors: Array<{ contributorId: string }>;
    };
    const deletedContributorId = directlyDeletedSource.contributors[0]?.contributorId;
    const directlyDeletedExcerpt = (await excerpts.create(users.a, {
      sourceId: directlyDeletedSource.id,
      selectedText: "This excerpt should be deleted with its source.",
      pageUrl: `https://example.test/${runId}/source-cascade`,
      excerptType: ExcerptType.NOTE,
      projectIds: [sourceDeleteProject.id],
    })) as { id: string };
    await sourceRepository.delete(users.a, directlyDeletedSource.id);
    await expect(
      prisma.excerpt.findUnique({ where: { id: directlyDeletedExcerpt.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.contributor.findUnique({ where: { id: deletedContributorId } }),
    ).resolves.toBeNull();

    const cascadingProject = await projects.create(users.a, {
      name: `${runId}-project-cascade`,
    });
    const cascadingSource = (await sources.create(users.a, {
      title: "Project cascade test",
      url: `https://example.test/${runId}/project-cascade`,
      sourceType: SourceType.ARTICLE,
      projectIds: [cascadingProject.id],
    })) as { id: string };
    const cascadingExcerpt = (await excerpts.create(users.a, {
      sourceId: cascadingSource.id,
      selectedText: "This excerpt should be deleted with its project source.",
      pageUrl: `https://example.test/${runId}/project-cascade`,
      excerptType: ExcerptType.NOTE,
      projectIds: [cascadingProject.id],
    })) as { id: string };
    await projects.updateState(users.a, cascadingProject.id, {
      isActive: false,
    });
    await expect(
      projects.deletePermanently(users.a, cascadingProject.id),
    ).resolves.toBe(true);
    await expect(
      prisma.source.findUnique({ where: { id: cascadingSource.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.excerpt.findUnique({ where: { id: cascadingExcerpt.id } }),
    ).resolves.toBeNull();
  });

  it("paginates and filters sources and excerpts in PostgreSQL", async () => {
    const project = await projects.create(users.a, { name: `${runId}-pagination` });
    const source = (await sources.create(users.a, {
      title: `Unique searchable title ${runId}`,
      url: `https://example.test/${runId}/pagination`,
      sourceType: SourceType.REPORT,
      projectIds: [project.id],
      tagNames: ["pagination-tag"],
    })) as { id: string };
    await excerpts.create(users.a, {
      sourceId: source.id,
      selectedText: `Unique searchable excerpt ${runId}`,
      pageUrl: `https://example.test/${runId}/pagination`,
      excerptType: ExcerptType.EVIDENCE,
      projectIds: [project.id],
      tagNames: ["pagination-tag"],
    });

    const sourcePage = await sourceRepository.listPage(users.a, {
      skip: 0, take: 1, q: `searchable title ${runId}`, projectId: project.id,
      tag: "pagination-tag", type: "Report",
    });
    expect(sourcePage.total).toBe(1);
    expect(sourcePage.rows).toHaveLength(1);

    const excerptPage = await excerpts.listPage(users.a, {
      skip: 0, take: 1, q: `searchable excerpt ${runId}`, sourceId: source.id,
      projectId: project.id, tag: "pagination-tag", type: "Evidence",
    });
    expect(excerptPage.total).toBe(1);
    expect(excerptPage.rows).toHaveLength(1);
  });
});
