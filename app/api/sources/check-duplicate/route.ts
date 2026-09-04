import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { sourceDto } from "@/lib/api/dto";
import { apiError } from "@/lib/api/responses";
import { researchService } from "@/lib/services/research-service";
import { duplicateQuerySchema } from "@/lib/api/schemas";
import { parseQuery } from "@/lib/api/validation";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const query = parseQuery(request.nextUrl, duplicateQuerySchema);
    const match = await researchService.sources.checkDuplicate(user.id, {
      url: query.url,
      doi: query.doi || undefined,
      canonicalUrl: query.canonicalUrl,
    });
    return NextResponse.json({
      duplicate: Boolean(match),
      source: match
        ? sourceDto(match as Parameters<typeof sourceDto>[0])
        : null,
    });
  } catch (error) {
    return apiError(error, request);
  }
}
