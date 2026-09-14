import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { apiError } from "@/lib/api/responses";
import { localDocumentEnrichmentSchema } from "@/lib/api/schemas";
import { parseJson } from "@/lib/api/validation";
import { parseCitationName, toCitationDate } from "@/lib/citations/normalized";
import { provenanceValue } from "@/lib/metadata/provenance";
import { detectIdentifierSet } from "@/lib/metadata/providers/identifiers";
import { mergeMetadataCandidates } from "@/lib/metadata/providers/merge";
import { enrichMetadata } from "@/lib/metadata/providers/registry";
import type { ResolvedSourceMetadata } from "@/lib/metadata/types";

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
    const body = await parseJson(request, localDocumentEnrichmentSchema);
    const identifiers = detectIdentifierSet(body.doi, body.isbn);
    const run = await enrichMetadata(identifiers);
    const citationData = {
      title: body.title || "",
      type: body.isbn ? "book" : "article-journal",
      authors: body.authors.map(parseCitationName),
      issued: toCitationDate(body.date),
      doi: identifiers.doi,
      isbn: identifiers.isbn,
      abstract: body.description || undefined,
    };
    const provenance = {
      ...(body.title ? { title: provenanceValue(body.title, "PDF_METADATA", "MEDIUM") } : {}),
      ...(body.authors.length ? { authors: provenanceValue(body.authors, "PDF_METADATA", "MEDIUM") } : {}),
      ...(body.date ? { publicationDate: provenanceValue(body.date, "PDF_METADATA", "LOW") } : {}),
      ...(identifiers.doi ? { doi: provenanceValue(identifiers.doi, "PDF_METADATA", "MEDIUM") } : {}),
      ...(identifiers.isbn?.length ? { isbn: provenanceValue(identifiers.isbn, "PDF_METADATA", "MEDIUM") } : {}),
    };
    const base: ResolvedSourceMetadata = {
      title: body.title || "",
      authors: body.authors,
      organization: "",
      date: body.date || "",
      url: "",
      doi: identifiers.doi,
      type: body.isbn ? "Book" : "Article",
      description: body.description || "",
      citationData,
      provenance,
      metadataNeedsReview: true,
    };
    const metadata = mergeMetadataCandidates(base, run.candidates);
    return NextResponse.json({
      ...metadata,
      enrichment: {
        attempted: run.selectedProviders,
        results: run.results.map(({ provider, status, cacheHit }) => ({
          provider,
          status,
          cacheHit,
        })),
      },
    });
  } catch (error) {
    return apiError(error, request);
  }
}
