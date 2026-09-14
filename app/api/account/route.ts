import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/responses";
import { ConfigurationError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db/prisma";
import { serverEnv } from "@/lib/env";
import { accountDeletionSchema } from "@/lib/api/schemas";
import { parseJson } from "@/lib/api/validation";
import { logger } from "@/lib/api/logger";

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser(request);
    await parseJson(request, accountDeletionSchema);
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey)
      throw new ConfigurationError("Account deletion is not configured for this deployment");
    const env = serverEnv();
    const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    // Delete application data first. Cascades run in one PostgreSQL statement.
    // If Auth cleanup fails, the user can sign in again and safely retry; requireUser
    // recreates the now-empty application user without restoring deleted data.
    await prisma.user.deleteMany({ where: { id: user.id } });
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      logger.error("auth_account_deletion_failed", {
        errorName: error.name,
        status: error.status,
      });
      throw new Error("Authentication account deletion failed");
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError(error, request);
  }
}
