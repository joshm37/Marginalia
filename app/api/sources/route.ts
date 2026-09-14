import { SourceStorageMode, SourceType } from "@/lib/generated/prisma/enums";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { sourceDto } from "@/lib/api/dto";
import { apiError } from "@/lib/api/responses";
import { researchService } from "@/lib/services/research-service";
import { sourceListQuerySchema, sourceInputSchema } from "@/lib/api/schemas";
import { parseJson, parseQuery } from "@/lib/api/validation";
import { normalizeReviewedCitation } from "@/lib/citations/normalized";
import { citationPersistenceData } from "@/lib/citations/persistence";
import { finalizeReviewedProvenance } from "@/lib/metadata/provenance";
import { sourceUrlDebugSnapshot } from "@/lib/sources/storage-url";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const requestedPagination =
      request.nextUrl.searchParams.has("page") ||
      request.nextUrl.searchParams.has("pageSize");
    if (requestedPagination) {
      const pagination = parseQuery(request.nextUrl, sourceListQuerySchema);
      const result = await researchService.sources.listPage(user.id, {
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        q: pagination.q || undefined,
        type: pagination.type,
        projectId: pagination.projectId,
        tag: pagination.tag || undefined,
        reviewOnly: pagination.reviewOnly === "true",
        sort: pagination.sort,
      });
      return NextResponse.json({
        items: result.rows.map((row) =>
          sourceDto(row as Parameters<typeof sourceDto>[0]),
        ),
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: result.total,
        pageCount: Math.ceil(result.total / pagination.pageSize),
      });
    }
    const rows = await researchService.sources.list(user.id);
    return NextResponse.json(
      rows.map((row) => sourceDto(row as Parameters<typeof sourceDto>[0])),
    );
  } catch (error) {
    return apiError(error, request);
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (
      process.env.NODE_ENV === "development" &&
      request.headers.get("x-marginalia-local-pdf-debug") === "1"
    ) {
      const debugBody = await request.clone().json().catch(() => undefined);
      console.info(
        "LOCAL_PDF_SAVE_DEBUG_V3_SERVER",
        sourceUrlDebugSnapshot(debugBody, request.nextUrl.pathname),
      );
    }
    const body = await parseJson(request, sourceInputSchema);
    const citation = normalizeReviewedCitation(body);
    const review = finalizeReviewedProvenance(
      citation,
      body.metadataProvenance,
      body.reviewedFields,
    );
    const row = await researchService.sources.create(user.id, {
      title: body.title,
      authors: body.authors || undefined,
      organization: body.organization || undefined,
      publicationDate: body.date ? new Date(body.date) : undefined,
      sourceType:
        SourceType[
          String(
            body.type ?? "Article",
          ).toUpperCase() as keyof typeof SourceType
        ] ?? SourceType.ARTICLE,
      url: body.url || undefined,
      storageMode: body.storageMode ? SourceStorageMode[body.storageMode] : undefined,
      localFile: body.localFile
        ? { ...body.localFile, fileSize: BigInt(body.localFile.fileSize) }
        : body.localFile,
      canonicalUrl: body.canonicalUrl || undefined,
      doi: body.doi || undefined,
      ...citationPersistenceData(citation, review.provenance, {
        preserveCitationUrl: body.storageMode === "LOCAL",
      }),
      metadataNeedsReview: review.metadataNeedsReview,
      description: body.description || undefined,
      bibliographyAnnotation: body.bibliographyAnnotation || undefined,
      notes: body.notes || undefined,
      projectIds: body.projects,
      tagNames: body.tags,
    });
    return NextResponse.json(
      sourceDto(row as Parameters<typeof sourceDto>[0]),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error, request);
  }
}
