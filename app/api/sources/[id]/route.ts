import { SourceType } from "@/lib/generated/prisma/enums";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { apiError } from "@/lib/api/responses";
import { sourceDto } from "@/lib/api/dto";
import { researchService } from "@/lib/services/research-service";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const deleted = await researchService.sources.delete(user.id, id);
    return deleted
      ? new NextResponse(null, { status: 204 })
      : NextResponse.json({ error: "Source not found" }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const body = await request.json();
    const row =
      body.action === "updateBibliographyAnnotation"
        ? await researchService.sources.updateBibliographyAnnotation(
            user.id,
            id,
            {
              bibliographyAnnotation: String(body.bibliographyAnnotation ?? ""),
              includeInBibliography: body.includeInBibliography !== false,
            },
          )
        : body.title
          ? await researchService.sources.update(user.id, id, {
              title: String(body.title),
              authors: body.authors || undefined,
              organization: body.organization || undefined,
              publicationDate: body.date ? new Date(body.date) : undefined,
              sourceType:
                SourceType[
                  String(
                    body.type ?? "Article",
                  ).toUpperCase() as keyof typeof SourceType
                ] ?? SourceType.ARTICLE,
              url: String(body.url ?? ""),
              description: body.description || undefined,
              bibliographyAnnotation: body.bibliographyAnnotation || undefined,
              notes: body.notes || undefined,
              projectIds: Array.isArray(body.projects) ? body.projects : [],
              tagNames: Array.isArray(body.tags) ? body.tags : [],
            })
          : await researchService.sources.moveToProject(
              user.id,
              id,
              String(body.projectId ?? ""),
            );
    return row
      ? NextResponse.json(sourceDto(row as Parameters<typeof sourceDto>[0]))
      : NextResponse.json(
          { error: "Source or project not found" },
          { status: 404 },
        );
  } catch (error) {
    return apiError(error);
  }
}
