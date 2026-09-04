import { detectDoi } from "@/lib/citations/identifiers";
import { displayCitationNames } from "@/lib/citations/normalized";
import type { NormalizedCitationData } from "@/lib/citations/types";
import { enrichDoiWithCrossrefDetailed } from "@/lib/metadata/crossref";
import { extractHtmlMetadataWithDiagnostics } from "@/lib/metadata/extract-html";
import { safeFetchHtml } from "@/lib/metadata/safe-fetch";
import type {
  AnalysisStatus,
  ExtractionDiagnostics,
  ResolvedSourceMetadata,
  WebpageAnalysis,
} from "@/lib/metadata/types";

function meaningfulEntries(data: NormalizedCitationData) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) =>
      Array.isArray(value)
        ? value.length > 0
        : value !== undefined && value !== "",
    ),
  );
}

function sourceType(cslType: string, fallback: ResolvedSourceMetadata["type"]) {
  if (cslType === "article-journal") return "Article";
  if (cslType === "report") return "Report";
  if (cslType === "book") return "Book";
  return fallback;
}

function fallbackMetadata(url: string, doi?: string): ResolvedSourceMetadata {
  const now = new Date();
  return {
    title: "",
    authors: [],
    organization: "",
    date: "",
    url,
    canonicalUrl: url,
    doi,
    type: "Website",
    description: "",
    citationData: {
      title: "",
      type: "webpage",
      authors: [],
      url,
      doi,
      accessed: {
        "date-parts": [[now.getFullYear(), now.getMonth() + 1, now.getDate()]],
      },
    },
  };
}

function mergeCrossref(
  extracted: ResolvedSourceMetadata,
  enriched: NormalizedCitationData,
) {
  const citationData: NormalizedCitationData = {
    ...extracted.citationData,
    ...meaningfulEntries(enriched),
    url: extracted.canonicalUrl || extracted.url,
    accessed: extracted.citationData.accessed,
    abstract: extracted.citationData.abstract || enriched.abstract,
  };
  const issued = citationData.issued?.["date-parts"]?.[0];
  return {
    ...extracted,
    title: citationData.title || extracted.title,
    authors: citationData.authors
      .map((author) => displayCitationNames([author]))
      .filter(Boolean),
    organization: citationData.publisher || extracted.organization,
    date: issued
      ? [
          issued[0],
          issued[1]?.toString().padStart(2, "0"),
          issued[2]?.toString().padStart(2, "0"),
        ]
          .filter(Boolean)
          .join("-")
      : extracted.date,
    type: sourceType(citationData.type, extracted.type),
    containerTitle: citationData.containerTitle,
    volume: citationData.volume,
    issue: citationData.issue,
    pages: citationData.pages,
    doi: citationData.doi || extracted.doi,
    citationData,
    enrichedBy: "crossref" as const,
  } satisfies ResolvedSourceMetadata;
}

function hasUsefulExtractedMetadata(metadata: ResolvedSourceMetadata) {
  return Boolean(
    metadata.title ||
      metadata.authors.length ||
      metadata.organization ||
      metadata.date ||
      metadata.containerTitle ||
      metadata.doi,
  );
}

function isCompleteEnough(metadata: ResolvedSourceMetadata) {
  return Boolean(
    metadata.title &&
      (metadata.authors.length || metadata.organization) &&
      (metadata.date || metadata.containerTitle || metadata.doi),
  );
}

function appearsToBeChallenge(html: string, metadata: ResolvedSourceMetadata) {
  const sample = html.slice(0, 150_000);
  const signals = [
    /cf-chl-|cloudflare ray id|checking your browser/i,
    /enable javascript and cookies to continue/i,
    /verify (?:that )?you are (?:a )?human/i,
    /access denied|request unsuccessful/i,
  ];
  return signals.some((signal) => signal.test(sample)) && !isCompleteEnough(metadata);
}

function warningForIncomplete(metadata: ResolvedSourceMetadata) {
  const missing = [
    !metadata.title && "title",
    !metadata.authors.length && "authors",
    !metadata.date && "publication date",
    !metadata.containerTitle && "journal or container",
  ].filter(Boolean);
  return missing.length
    ? `Metadata is incomplete. Please review ${missing.join(", ")}.`
    : undefined;
}

export async function analyzeWebpage(
  rawUrl: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<WebpageAnalysis> {
  const normalizedUrl = new URL(rawUrl).toString();
  const doiFromUrl = detectDoi(normalizedUrl);
  const [retrieval, initialCrossref] = await Promise.all([
    safeFetchHtml(normalizedUrl, fetchImplementation),
    enrichDoiWithCrossrefDetailed(doiFromUrl),
  ]);

  let metadata = fallbackMetadata(
    retrieval.diagnostics.finalUrl || normalizedUrl,
    doiFromUrl,
  );
  let extraction: ExtractionDiagnostics = {
    citationMetaTags: 0,
    dublinCoreMetaTags: 0,
    openGraphMetaTags: 0,
    prismMetaTags: 0,
    jsonLdObjects: 0,
    detectedDoi: doiFromUrl,
    crossrefAttempted: initialCrossref.attempted,
    crossrefSucceeded: initialCrossref.succeeded,
  };
  const warnings = retrieval.warning ? [retrieval.warning] : [];
  let status: AnalysisStatus =
    retrieval.status === "OK" ? "NO_METADATA" : retrieval.status;

  if (retrieval.status === "OK" && retrieval.html !== undefined) {
    const result = extractHtmlMetadataWithDiagnostics(
      retrieval.html,
      retrieval.diagnostics.finalUrl || normalizedUrl,
    );
    metadata = result.metadata;
    extraction = { ...result.diagnostics };
    if (appearsToBeChallenge(retrieval.html, metadata)) {
      status = "BLOCKED";
      warnings.push(
        "The website returned a bot-check or access-denied page instead of the article.",
      );
    } else if (!hasUsefulExtractedMetadata(metadata)) {
      status = "NO_METADATA";
      warnings.push(
        "HTML was received, but it did not contain usable citation metadata.",
      );
    } else {
      status =
        isCompleteEnough(metadata) && !retrieval.diagnostics.truncated
          ? "SUCCESS"
          : "PARTIAL";
    }
  }

  const detectedDoi = metadata.doi || doiFromUrl;
  const crossref =
    detectedDoi && detectedDoi !== doiFromUrl
      ? await enrichDoiWithCrossrefDetailed(detectedDoi)
      : initialCrossref;
  extraction.detectedDoi = detectedDoi;
  extraction.crossrefAttempted = crossref.attempted;
  extraction.crossrefSucceeded = crossref.succeeded;

  if (crossref.data) {
    metadata = mergeCrossref(metadata, crossref.data);
    status =
      retrieval.status === "OK" &&
      status !== "BLOCKED" &&
      !retrieval.diagnostics.truncated &&
      isCompleteEnough(metadata)
        ? "SUCCESS"
        : "PARTIAL";
  } else if (crossref.attempted) {
    warnings.push(
      "A DOI was found, but Crossref enrichment was unavailable. Extracted metadata is still editable.",
    );
  }

  const incompleteWarning = warningForIncomplete(metadata);
  if (incompleteWarning && !warnings.includes(incompleteWarning))
    warnings.push(incompleteWarning);

  return {
    ...metadata,
    analysis: {
      status,
      warnings,
      retrieval: retrieval.diagnostics,
      extraction,
    },
  };
}
