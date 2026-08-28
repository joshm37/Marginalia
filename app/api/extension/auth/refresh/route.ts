import { NextResponse } from 'next/server';
import { createStatelessClient } from '@/lib/supabase/stateless';

export async function POST(request: Request) {
  const { refreshToken } = await request.json();
  if (!refreshToken) return NextResponse.json({ error: 'Refresh token is required' }, { status: 400 });
  const { data, error } = await createStatelessClient().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) return NextResponse.json({ error: error?.message ?? 'Session expired' }, { status: 401 });
  return NextResponse.json({ accessToken: data.session.access_token, refreshToken: data.session.refresh_token, expiresAt: data.session.expires_at, user: { id: data.user?.id, email: data.user?.email } });
}
