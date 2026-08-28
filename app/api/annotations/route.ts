import { AnnotationType } from '@/lib/generated/prisma/enums';
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { annotationDto } from '@/lib/api/dto';
import { apiError } from '@/lib/api/responses';
import { researchService } from '@/lib/services/research-service';

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request); const body = await request.json();
    const row = await researchService.annotations.create(user.id, {
      sourceId: String(body.sourceId ?? ''), selectedText: String(body.selectedText ?? ''), surroundingText: body.surroundingText || undefined,
      note: body.note || undefined, pageUrl: String(body.pageUrl ?? body.url ?? ''), annotationType: AnnotationType[String(body.type ?? 'Quote').toUpperCase() as keyof typeof AnnotationType] ?? AnnotationType.QUOTE,
      locationData: body.locationData, projectIds: Array.isArray(body.projects) ? body.projects : [], tagNames: Array.isArray(body.tags) ? body.tags : [],
    });
    return NextResponse.json(annotationDto(row as Parameters<typeof annotationDto>[0]), { status: 201 });
  } catch (error) { return apiError(error); }
}
