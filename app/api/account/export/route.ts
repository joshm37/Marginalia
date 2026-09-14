import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db/prisma";
import { apiError } from "@/lib/api/responses";
import { NotFoundError } from "@/lib/api/errors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const authenticated = await requireUser(request);
    const user = await prisma.user.findFirst({
      where: { id: authenticated.id },
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
        updatedAt: true,
        projects: { orderBy: { createdAt: "asc" } },
        tags: { orderBy: { createdAt: "asc" } },
        contributors: {
          select: {
            id: true, given: true, family: true, literal: true, suffix: true,
            isLegacy: true, createdAt: true, updatedAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
        sources: {
          orderBy: { createdAt: "asc" },
          include: {
            localFile: true,
            projects: { select: { projectId: true, addedAt: true } },
            tags: { select: { tagId: true } },
            contributors: {
              select: { contributorId: true, role: true, sequence: true },
              orderBy: [{ role: "asc" }, { sequence: "asc" }],
            },
            excerpts: { select: { id: true } },
          },
        },
        excerpts: {
          orderBy: { createdAt: "asc" },
          include: {
            projects: { select: { projectId: true } },
            tags: { select: { tagId: true } },
          },
        },
      },
    });
    if (!user) throw new NotFoundError("Account data not found");

    const archive = {
      format: "marginalia-account-export",
      version: 1,
      generatedAt: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      projects: user.projects,
      tags: user.tags,
      contributors: user.contributors,
      sources: user.sources.map((source) => ({
        ...source,
        localFile: source.localFile
          ? { ...source.localFile, fileSize: Number(source.localFile.fileSize) }
          : null,
      })),
      excerpts: user.excerpts,
      files: user.sources
        .filter((source) => source.fileUrl)
        .map((source) => ({ sourceId: source.id, reference: source.fileUrl })),
    };

    const date = new Date().toISOString().slice(0, 10);
    return NextResponse.json(archive, {
      headers: {
        "content-disposition": `attachment; filename="marginalia-data-${date}.json"`,
        "cache-control": "private, no-store, max-age=0",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error, request);
  }
}
