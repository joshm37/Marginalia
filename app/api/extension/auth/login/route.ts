import { NextResponse } from "next/server";
import { createStatelessClient } from "@/lib/supabase/stateless";
import { extensionLoginSchema } from "@/lib/api/schemas";
import { parseJson } from "@/lib/api/validation";
import { apiError } from "@/lib/api/responses";
import {
  enforceRateLimit,
  requestClientKey,
  sensitiveValueKey,
} from "@/lib/api/rate-limit";
import { UnauthorizedError } from "@/lib/api/errors";

export async function POST(request: Request) {
  try {
    const { email, password } = await parseJson(request, extensionLoginSchema);
    await Promise.all([
      enforceRateLimit({
        namespace: "extension-login-ip",
        identifier: requestClientKey(request),
        limit: 20,
        windowSeconds: 900,
      }),
      enforceRateLimit({
        namespace: "extension-login-account",
        identifier: sensitiveValueKey(email),
        limit: 10,
        windowSeconds: 900,
      }),
    ]);
    const { data, error } =
      await createStatelessClient().auth.signInWithPassword({
        email,
        password,
      });
    if (error || !data.session)
      throw new UnauthorizedError("Email or password is incorrect");
    return NextResponse.json(
      {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
        user: { id: data.user.id, email: data.user.email },
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return apiError(error, request);
  }
}
