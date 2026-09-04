import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { UnauthorizedError } from "@/lib/api/errors";
import { serverEnv } from "@/lib/env";
import type { User } from "@supabase/supabase-js";

export { UnauthorizedError } from "@/lib/api/errors";

type AuthenticatedUser = Pick<User, "id" | "email" | "user_metadata">;

export async function requireUser(
  request?: NextRequest,
): Promise<AuthenticatedUser> {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.E2E_TEST_MODE === "true"
  ) {
    const user = {
      id: "e2e-test-user",
      email: "e2e@marginalia.test",
      user_metadata: { full_name: "E2E Researcher" },
    };
    await prisma.user.upsert({
      where: { id: user.id },
      update: { email: user.email, displayName: "E2E Researcher" },
      create: { id: user.id, email: user.email, displayName: "E2E Researcher" },
    });
    return user;
  }
  serverEnv();
  const supabase = await createClient();
  const header = request?.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user?.email)
    throw new UnauthorizedError("Authentication required");
  await prisma.user.upsert({
    where: { id: user.id },
    update: {
      email: user.email,
      displayName:
        user.user_metadata.full_name ?? user.user_metadata.name ?? undefined,
    },
    create: {
      id: user.id,
      email: user.email,
      displayName:
        user.user_metadata.full_name ?? user.user_metadata.name ?? undefined,
    },
  });
  return user;
}
