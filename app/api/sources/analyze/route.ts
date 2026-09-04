import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/responses";
import { requireUser } from "@/lib/auth/require-user";
import { analyzeWebpage } from "@/lib/metadata/analyze-webpage";
import { analyzeSchema } from "@/lib/api/schemas";
import { parseJson } from "@/lib/api/validation";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { logger } from "@/lib/api/logger";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    await enforceRateLimit({
      namespace: "metadata",
      identifier: user.id,
      limit: 30,
      windowSeconds: 60,
    });
    const body = await parseJson(request, analyzeSchema);
    const result = await analyzeWebpage(body.url);
    logger.info("source_link_analyzed", {
      userId: user.id,
      status: result.analysis.status,
      retrieval: result.analysis.retrieval,
      extraction: result.analysis.extraction,
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error, request);
  }
}
