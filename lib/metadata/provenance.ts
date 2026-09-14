import type {
  MetadataConfidence,
  MetadataField,
  MetadataProvenance,
  MetadataProvider,
  ProvenancedMetadataValue,
} from "@/lib/metadata/types";
import type { NormalizedCitationData } from "@/lib/citations/types";

export const IMPORTANT_METADATA_FIELDS: MetadataField[] = [
  "title",
  "authors",
  "publicationDate",
  "containerTitle",
];

export function provenanceValue(
  value: unknown,
  provider: MetadataProvider,
  confidence: MetadataConfidence,
  reviewed = false,
): ProvenancedMetadataValue {
  return { value, provider, confidence, reviewed };
}

export function needsMetadataReview(provenance: MetadataProvenance) {
  const title = provenance.title;
  const authors = provenance.authors;
  const publisher = provenance.publisher;
  const hasValue = (item: ProvenancedMetadataValue | undefined) =>
    Array.isArray(item?.value)
      ? item.value.length > 0
      : item?.value !== undefined && item.value !== null && item.value !== "";
  const hasScholarlyAnchor = [
    provenance.publicationDate,
    provenance.containerTitle,
    provenance.doi,
  ].some(hasValue);
  if (
    !hasValue(title) ||
    (!hasValue(authors) && !hasValue(publisher)) ||
    !hasScholarlyAnchor
  )
    return true;
  return IMPORTANT_METADATA_FIELDS.some((field) => {
    const item = provenance[field];
    return Boolean(item?.value && item.confidence === "LOW" && !item.reviewed);
  });
}

export function markUserReviewed(
  provenance: MetadataProvenance,
  values: Partial<Record<MetadataField, unknown>>,
  fields: MetadataField[],
) {
  const result = { ...provenance };
  for (const field of fields)
    result[field] = provenanceValue(values[field], "USER", "HIGH", true);
  return result;
}

export function citationValues(data: NormalizedCitationData) {
  return {
    title: data.title,
    authors: data.authors,
    editors: data.editors,
    translators: data.translators,
    publisher: data.publisher,
    publicationDate: data.issued,
    accessedDate: data.accessed,
    containerTitle: data.containerTitle,
    volume: data.volume,
    issue: data.issue,
    pages: data.pages,
    edition: data.edition,
    publisherPlace: data.publisherPlace,
    doi: data.doi,
    isbn: data.isbn,
    issn: data.issn,
    language: data.language,
    description: data.abstract,
    url: data.url,
    sourceType: data.type,
  } satisfies Partial<Record<MetadataField, unknown>>;
}

export function finalizeReviewedProvenance(
  data: NormalizedCitationData,
  provenance: MetadataProvenance = {},
  reviewedFields?: MetadataField[],
) {
  const values = citationValues(data);
  const fields = reviewedFields ??
    (Object.keys(provenance).length
      ? []
      : (Object.entries(values)
          .filter(([, value]) =>
            Array.isArray(value) ? value.length : value !== undefined && value !== "",
          )
          .map(([field]) => field) as MetadataField[]));
  const resolved = markUserReviewed(provenance, values, fields);
  return {
    provenance: resolved,
    metadataNeedsReview: needsMetadataReview(resolved),
  };
}

export function provenanceLabel(value?: ProvenancedMetadataValue) {
  if (!value) return "May need review";
  if (value.reviewed || value.provider === "USER") return "Manually confirmed";
  if (value.provider === "CROSSREF") return "Verified from DOI";
  if (value.provider === "PDF_METADATA") return "Found in PDF — please review";
  if (value.confidence === "LOW" || value.provider === "URL_INFERENCE")
    return "May need review";
  return "Found on webpage";
}
