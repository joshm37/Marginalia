import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { sourceDto } from '@/lib/api/dto';
import { apiError } from '@/lib/api/responses';
import { researchService } from '@/lib/services/research-service';

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request); const query = request.nextUrl.searchParams; const url = query.get('url');
    if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 });
    const match = await researchService.sources.checkDuplicate(user.id, { url, doi: query.get('doi') ?? undefined, canonicalUrl: query.get('canonicalUrl') ?? undefined });
    return NextResponse.json({ duplicate: Boolean(match), source: match ? sourceDto(match as Parameters<typeof sourceDto>[0]) : null });
  } catch (error) { return apiError(error); }
}
