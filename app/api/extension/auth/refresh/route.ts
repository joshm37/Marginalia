import { NextResponse } from "next/server";
import { createStatelessClient } from "@/lib/supabase/stateless";
import { extensionRefreshSchema } from "@/lib/api/schemas";
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
    const { refreshToken } = await parseJson(request, extensionRefreshSchema);
    await enforceRateLimit({
      namespace: "extension-refresh",
      identifier: `${requestClientKey(request)}:${sensitiveValueKey(refreshToken)}`,
      limit: 30,
      windowSeconds: 900,
    });
    const { data, error } = await createStatelessClient().auth.refreshSession({
      refresh_token: refreshToken,
    });
    if (error || !data.session) throw new UnauthorizedError("Session expired");
    return NextResponse.json(
      {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
        user: { id: data.user?.id, email: data.user?.email },
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return apiError(error, request);
  }
}
