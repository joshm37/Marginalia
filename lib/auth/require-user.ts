import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db/prisma';

export class UnauthorizedError extends Error {}

export async function requireUser(request?: NextRequest) {
  const supabase = await createClient();
  const header = request?.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user?.email) throw new UnauthorizedError('Authentication required');

  await prisma.user.upsert({
    where: { id: user.id },
    update: { email: user.email, displayName: user.user_metadata.full_name ?? user.user_metadata.name ?? undefined },
    create: { id: user.id, email: user.email, displayName: user.user_metadata.full_name ?? user.user_metadata.name ?? undefined },
  });
  return user;
}
