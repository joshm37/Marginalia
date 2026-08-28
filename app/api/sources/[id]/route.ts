import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { apiError } from '@/lib/api/responses';
import { researchService } from '@/lib/services/research-service';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const user = await requireUser(request); const { id } = await params; const deleted = await researchService.sources.delete(user.id, id); return deleted ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: 'Source not found' }, { status: 404 }); }
  catch (error) { return apiError(error); }
}
