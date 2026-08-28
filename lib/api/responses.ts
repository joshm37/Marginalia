import { NextResponse } from 'next/server';
import { UnauthorizedError } from '@/lib/auth/require-user';
import { DuplicateSourceError } from '@/lib/services/source-service';

export function apiError(error: unknown) {
  if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
  if (error instanceof DuplicateSourceError) return NextResponse.json({ error: error.message, existingSource: error.existingSource }, { status: 409 });
  const message = error instanceof Error ? error.message : 'Unexpected server error';
  return NextResponse.json({ error: message }, { status: 400 });
}
