import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { apiError } from "@/lib/api/responses";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { doiEnrichmentSchema } from "@/lib/api/schemas";
import { parseJson } from "@/lib/api/validation";
import { displayCitationNames } from "@/lib/citations/normalized";
import { enrichDoiWithCrossref } from "@/lib/metadata/crossref";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    await enforceRateLimit({
      namespace: "doi-enrichment",
      identifier: user.id,
      limit: 30,
      windowSeconds: 60,
    });
    const { doi } = await parseJson(request, doiEnrichmentSchema);
    const citationData = await enrichDoiWithCrossref(doi);
    if (!citationData)
      return NextResponse.json({ enriched: false, citationData: null });
    const issued = citationData.issued?.["date-parts"]?.[0];
    return NextResponse.json({
      enriched: true,
      title: citationData.title,
      authors: citationData.authors.map((author) =>
        displayCitationNames([author]),
      ),
      organization: citationData.publisher ?? "",
      date: issued
        ? [
            issued[0],
            issued[1]?.toString().padStart(2, "0"),
            issued[2]?.toString().padStart(2, "0"),
          ]
            .filter(Boolean)
            .join("-")
        : "",
      url: citationData.url,
      doi: citationData.doi,
      containerTitle: citationData.containerTitle,
      volume: citationData.volume,
      issue: citationData.issue,
      pages: citationData.pages,
      citationData,
    });
  } catch (error) {
    return apiError(error, request);
  }
}
