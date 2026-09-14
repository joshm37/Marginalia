import type { CreateSourceInput } from "@/lib/repositories/contracts";
import type {
  CitationName,
  NormalizedCitationData,
} from "@/lib/citations/types";
import type { MetadataProvenance } from "@/lib/metadata/types";

const authoritativeKeys = new Set([
  "title",
  "type",
  "authors",
  "editors",
  "translators",
  "containerTitle",
  "volume",
  "issue",
  "pages",
  "publisher",
  "publisherPlace",
  "edition",
  "issued",
  "accessed",
  "url",
  "doi",
  "isbn",
  "issn",
  "language",
]);

function names(
  values: CitationName[] | undefined,
  role: "AUTHOR" | "EDITOR" | "TRANSLATOR",
) {
  return (values ?? [])
    .filter((value) => value.literal || value.family || value.given)
    .map((value, sequence) => ({ ...value, role, sequence }));
}

function date(value: NormalizedCitationData["accessed"]) {
  const parts = value?.["date-parts"]?.[0];
  if (!parts?.[0]) return undefined;
  const result = new Date(Date.UTC(parts[0], (parts[1] ?? 1) - 1, parts[2] ?? 1));
  return Number.isNaN(result.getTime()) ? undefined : result;
}

/** Split reviewed citation data into authoritative relational values and JSON extras. */
export function citationPersistenceData(
  data: NormalizedCitationData,
  provenance?: MetadataProvenance,
  options?: { preserveCitationUrl?: boolean },
): Pick<
  CreateSourceInput,
  | "contributors"
  | "containerTitle"
  | "volume"
  | "issue"
  | "pages"
  | "publisher"
  | "publisherPlace"
  | "edition"
  | "isbn"
  | "issn"
  | "accessedDate"
  | "language"
  | "citationMetadata"
> {
  const extras: Record<string, unknown> = Object.fromEntries(
    Object.entries(data).filter(([key, value]) => {
      if (authoritativeKeys.has(key)) return false;
      return value !== undefined && value !== null && value !== "";
    }),
  );
  if (provenance && Object.keys(provenance).length)
    extras.provenance = provenance;
  if (options?.preserveCitationUrl && /^https?:\/\//i.test(data.url ?? ""))
    extras.bibliographicUrl = data.url;
  return {
    contributors: [
      ...names(data.authors, "AUTHOR"),
      ...names(data.editors, "EDITOR"),
      ...names(data.translators, "TRANSLATOR"),
    ],
    containerTitle: data.containerTitle,
    volume: data.volume,
    issue: data.issue,
    pages: data.pages,
    publisher: data.publisher,
    publisherPlace: data.publisherPlace,
    edition: data.edition,
    isbn: data.isbn?.join(", "),
    issn: data.issn?.join(", "),
    accessedDate: date(data.accessed),
    language: data.language,
    citationMetadata: Object.keys(extras).length ? extras : undefined,
  };
}
