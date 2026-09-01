import { ExcerptType } from "@/lib/generated/prisma/enums";
import { NextRequest, NextResponse } from "next/server";
import { excerptDto } from "@/lib/api/dto";
import { apiError } from "@/lib/api/responses";
import { requireUser } from "@/lib/auth/require-user";
import { researchService } from "@/lib/services/research-service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const body = await request.json();
    const row = await researchService.excerpts.update(user.id, id, {
      sourceId: String(body.sourceId ?? ""),
      selectedText: String(body.selectedText ?? ""),
      surroundingText: body.surroundingText || undefined,
      note: body.note || undefined,
      pageUrl: String(body.pageUrl ?? body.url ?? ""),
      excerptType:
        ExcerptType[
          String(body.type ?? "Note").toUpperCase() as keyof typeof ExcerptType
        ] ?? ExcerptType.NOTE,
      locationData: body.locationData,
      projectIds: Array.isArray(body.projects) ? body.projects : [],
      tagNames: Array.isArray(body.tags) ? body.tags : [],
    });
    return row
      ? NextResponse.json(excerptDto(row as Parameters<typeof excerptDto>[0]))
      : NextResponse.json({ error: "Excerpt not found" }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const deleted = await researchService.excerpts.delete(user.id, id);
    return deleted
      ? new NextResponse(null, { status: 204 })
      : NextResponse.json({ error: "Excerpt not found" }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}
