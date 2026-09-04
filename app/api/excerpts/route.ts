import { ExcerptType } from "@/lib/generated/prisma/enums";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { excerptDto } from "@/lib/api/dto";
import { apiError } from "@/lib/api/responses";
import { researchService } from "@/lib/services/research-service";
import { excerptInputSchema, paginationSchema } from "@/lib/api/schemas";
import { parseJson, parseQuery } from "@/lib/api/validation";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const pagination = parseQuery(request.nextUrl, paginationSchema);
    const result = await researchService.excerpts.listPage(user.id, {
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    });
    return NextResponse.json({
      items: result.rows.map((row) =>
        excerptDto(row as Parameters<typeof excerptDto>[0]),
      ),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: result.total,
      pageCount: Math.ceil(result.total / pagination.pageSize),
    });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await parseJson(request, excerptInputSchema);
    const row = await researchService.excerpts.create(user.id, {
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
    return NextResponse.json(
      excerptDto(row as Parameters<typeof excerptDto>[0]),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error, request);
  }
}
