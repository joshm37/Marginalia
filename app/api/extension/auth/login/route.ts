import { NextResponse } from 'next/server';
import { createStatelessClient } from '@/lib/supabase/stateless';

export async function POST(request: Request) {
  const { email, password } = await request.json();
  if (!email || !password) return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  const { data, error } = await createStatelessClient().auth.signInWithPassword({ email, password });
  if (error || !data.session) return NextResponse.json({ error: error?.message ?? 'Sign in failed' }, { status: 401 });
  return NextResponse.json({ accessToken: data.session.access_token, refreshToken: data.session.refresh_token, expiresAt: data.session.expires_at, user: { id: data.user.id, email: data.user.email } });
}
