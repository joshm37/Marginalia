import { SourceType } from "@/lib/generated/prisma/enums";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { apiError } from "@/lib/api/responses";
import { sourceDto } from "@/lib/api/dto";
import { researchService } from "@/lib/services/research-service";
import { sourcePatchSchema } from "@/lib/api/schemas";
import { parseJson, parseResourceId } from "@/lib/api/validation";
import { normalizeReviewedCitation } from "@/lib/citations/normalized";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const id = parseResourceId((await params).id);
    const deleted = await researchService.sources.delete(user.id, id);
    return deleted
      ? new NextResponse(null, { status: 204 })
      : NextResponse.json({ error: "Source not found" }, { status: 404 });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const id = parseResourceId((await params).id);
    const body = await parseJson(request, sourcePatchSchema);
    let row;
    if ("action" in body) {
      row = await researchService.sources.updateBibliographyAnnotation(
        user.id,
        id,
        {
          bibliographyAnnotation: String(body.bibliographyAnnotation ?? ""),
          includeInBibliography: body.includeInBibliography !== false,
        },
      );
    } else if ("title" in body) {
      row = await researchService.sources.update(user.id, id, {
        title: body.title,
        authors: body.authors || undefined,
        organization: body.organization || undefined,
        publicationDate: body.date ? new Date(body.date) : undefined,
        sourceType:
          SourceType[
            String(
              body.type ?? "Article",
            ).toUpperCase() as keyof typeof SourceType
          ] ?? SourceType.ARTICLE,
        url: body.url,
        canonicalUrl: body.canonicalUrl || undefined,
        doi: body.doi || undefined,
        citationMetadata: normalizeReviewedCitation(body),
        description: body.description || undefined,
        bibliographyAnnotation: body.bibliographyAnnotation || undefined,
        notes: body.notes || undefined,
        projectIds: body.projects,
        tagNames: body.tags,
      });
    } else {
      row = await researchService.sources.moveToProject(
        user.id,
        id,
        body.projectId,
      );
    }
    return row
      ? NextResponse.json(sourceDto(row as Parameters<typeof sourceDto>[0]))
      : NextResponse.json(
          { error: "Source or project not found" },
          { status: 404 },
        );
  } catch (error) {
    return apiError(error, request);
  }
}
