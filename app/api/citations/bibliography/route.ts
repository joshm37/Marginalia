import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/responses";
import { bibliographyFormatSchema } from "@/lib/api/schemas";
import { parseJson } from "@/lib/api/validation";
import { requireUser } from "@/lib/auth/require-user";
import { citationEngine } from "@/lib/citations/citation-js-engine";
import { sourceToNormalizedCitation } from "@/lib/citations/normalized";
import type { Source } from "@/lib/types";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    await requireUser(request);
    const body = await parseJson(request, bibliographyFormatSchema);
    const sources = body.sources as Source[];
    return NextResponse.json({ entries: await citationEngine.formatMany(sources.map(sourceToNormalizedCitation), body.style, sources.map((source) => source.id), !body.preserveOrder) });
  } catch (error) { return apiError(error, request); }
}
