import { ExcerptType } from "@/lib/generated/prisma/enums";
import { NextRequest, NextResponse } from "next/server";
import { excerptDto } from "@/lib/api/dto";
import { apiError } from "@/lib/api/responses";
import { requireUser } from "@/lib/auth/require-user";
import { researchService } from "@/lib/services/research-service";
import { excerptInputSchema } from "@/lib/api/schemas";
import { parseJson, parseResourceId } from "@/lib/api/validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const id = parseResourceId((await params).id);
    const body = await parseJson(request, excerptInputSchema);
    const row = await researchService.excerpts.update(user.id, id, {
      sourceId: body.sourceId,
      selectedText: body.selectedText,
      surroundingText: body.surroundingText || undefined,
      note: body.note || undefined,
      pageUrl: body.pageUrl ?? body.url!,
      excerptType:
        ExcerptType[
          String(body.type ?? "Note").toUpperCase() as keyof typeof ExcerptType
        ] ?? ExcerptType.NOTE,
      locationData: body.locationData,
      projectIds: body.projects,
      tagNames: body.tags,
    });
    return row
      ? NextResponse.json(excerptDto(row as Parameters<typeof excerptDto>[0]))
      : NextResponse.json({ error: "Excerpt not found" }, { status: 404 });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const id = parseResourceId((await params).id);
    const deleted = await researchService.excerpts.delete(user.id, id);
    return deleted
      ? new NextResponse(null, { status: 204 })
      : NextResponse.json({ error: "Excerpt not found" }, { status: 404 });
  } catch (error) {
    return apiError(error, request);
  }
}
