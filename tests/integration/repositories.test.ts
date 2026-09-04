import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

  beforeAll(async () => {
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

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: Object.values(users) } },
    });
    await prisma.$disconnect();
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
        title: "Repository test source",
        type: "article-journal",
        authors: [{ given: "Ada", family: "Lovelace" }],
        volume: "4",
      },
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
    });
    expect(persisted?.citationMetadata).toMatchObject({
      authors: [{ given: "Ada", family: "Lovelace" }],
      volume: "4",
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

  it("cascades source deletion to excerpts and project deletion to sources", async () => {
    const sourceDeleteProject = await projects.create(users.a, {
      name: `${runId}-source-delete`,
    });
    const directlyDeletedSource = (await sources.create(users.a, {
      title: "Source cascade test",
      url: `https://example.test/${runId}/source-cascade`,
      sourceType: SourceType.ARTICLE,
      projectIds: [sourceDeleteProject.id],
    })) as { id: string };
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
});
