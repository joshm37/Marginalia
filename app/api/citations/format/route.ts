import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { apiError } from "@/lib/api/responses";
import { parseJson } from "@/lib/api/validation";
import { citationFormatSchema } from "@/lib/api/schemas";
import { citationEngine } from "@/lib/citations/citation-js-engine";
import { sourceToNormalizedCitation } from "@/lib/citations/normalized";
import type { Source } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await requireUser(request);
    const body = await parseJson(request, citationFormatSchema);
    const source = {
      ...body.source,
      authors: body.source.authors ?? "",
      organization: body.source.organization ?? "",
      date: body.source.date ?? "",
      description: body.source.description ?? "",
      notes: body.source.notes ?? "",
      projects: body.source.projects ?? [],
      tags: body.source.tags ?? [],
      createdAt: body.source.createdAt ?? "",
    } as Source;
    return NextResponse.json({
      citation: citationEngine.formatBibliography(
        sourceToNormalizedCitation(source),
        body.style,
      ),
    });
  } catch (error) {
    return apiError(error, request);
  }
}
