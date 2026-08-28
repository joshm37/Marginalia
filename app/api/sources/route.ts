import { SourceType } from '@/lib/generated/prisma/enums';
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { sourceDto } from '@/lib/api/dto';
import { apiError } from '@/lib/api/responses';
import { researchService } from '@/lib/services/research-service';

export async function GET(request: NextRequest) {
  try { const user = await requireUser(request); const rows = await researchService.sources.list(user.id); return NextResponse.json(rows.map(row => sourceDto(row as Parameters<typeof sourceDto>[0]))); }
  catch (error) { return apiError(error); }
}
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request); const body = await request.json();
    const row = await researchService.sources.create(user.id, {
      title: String(body.title ?? ''), authors: body.authors || undefined, organization: body.organization || undefined,
      publicationDate: body.date ? new Date(body.date) : undefined, sourceType: SourceType[String(body.type ?? 'Article').toUpperCase() as keyof typeof SourceType] ?? SourceType.ARTICLE,
      url: String(body.url ?? ''), canonicalUrl: body.canonicalUrl || undefined, doi: body.doi || undefined, description: body.description || undefined,
      notes: body.notes || undefined, projectIds: Array.isArray(body.projects) ? body.projects : [], tagNames: Array.isArray(body.tags) ? body.tags : [],
    });
    return NextResponse.json(sourceDto(row as Parameters<typeof sourceDto>[0]), { status: 201 });
  } catch (error) { return apiError(error); }
}
