import { extractHtmlMetadataWithDiagnostics } from "@/lib/metadata/extract-html";
import { detectIdentifierSet, mergeIdentifierSets } from "@/lib/metadata/providers/identifiers";
import { mergeMetadataCandidates } from "@/lib/metadata/providers/merge";
import { enrichMetadata } from "@/lib/metadata/providers/registry";
import { safeFetchHtml } from "@/lib/metadata/safe-fetch";
import type {
  AnalysisStatus,
  ExtractionDiagnostics,
  ResolvedSourceMetadata,
  WebpageAnalysis,
} from "@/lib/metadata/types";
import { provenanceValue } from "@/lib/metadata/provenance";

function fallbackMetadata(url: string, doi?: string): ResolvedSourceMetadata {
  const now = new Date();
  const provenance = {
    url: provenanceValue(url, "URL_INFERENCE", "LOW"),
    sourceType: provenanceValue("Website", "URL_INFERENCE", "LOW"),
    ...(doi
      ? { doi: provenanceValue(doi, "URL_INFERENCE", "MEDIUM") }
      : {}),
  };
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
    provenance,
    metadataNeedsReview: true,
  };
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
  const identifiersFromUrl = detectIdentifierSet(normalizedUrl);
  const [retrieval, initialEnrichment] = await Promise.all([
    safeFetchHtml(normalizedUrl, fetchImplementation),
    enrichMetadata(identifiersFromUrl),
  ]);

  let metadata = fallbackMetadata(
    retrieval.diagnostics.finalUrl || normalizedUrl,
    identifiersFromUrl.doi,
  );
  let extraction: ExtractionDiagnostics = {
    citationMetaTags: 0,
    dublinCoreMetaTags: 0,
    openGraphMetaTags: 0,
    prismMetaTags: 0,
    jsonLdObjects: 0,
    detectedDoi: identifiersFromUrl.doi,
    crossrefAttempted: initialEnrichment.selectedProviders.includes("CROSSREF"),
    crossrefSucceeded: initialEnrichment.results.some((result) => result.provider === "CROSSREF" && result.status === "SUCCESS"),
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

  const identifiers = mergeIdentifierSets(identifiersFromUrl, detectIdentifierSet(metadata.citationData, retrieval.html));
  const enrichment = JSON.stringify(identifiers) === JSON.stringify(identifiersFromUrl) ? initialEnrichment : await enrichMetadata(identifiers);
  extraction.detectedDoi = identifiers.doi;
  extraction.crossrefAttempted = enrichment.selectedProviders.includes("CROSSREF");
  extraction.crossrefSucceeded = enrichment.results.some((result) => result.provider === "CROSSREF" && result.status === "SUCCESS");
  extraction.enrichmentProviders = enrichment.results.map(({ provider, status, cacheHit }) => ({ provider, status, cacheHit }));

  if (enrichment.candidates.length) {
    metadata = mergeMetadataCandidates(metadata, enrichment.candidates);
    status =
      retrieval.status === "OK" &&
      status !== "BLOCKED" &&
      !retrieval.diagnostics.truncated &&
      isCompleteEnough(metadata)
        ? "SUCCESS"
        : "PARTIAL";
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
