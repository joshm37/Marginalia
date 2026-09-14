import { load } from "cheerio";
import { detectDoi } from "@/lib/citations/identifiers";
import {
  displayCitationNames,
  parseCitationName,
  toCitationDate,
} from "@/lib/citations/normalized";
import type {
  CitationName,
  NormalizedCitationData,
} from "@/lib/citations/types";
import type {
  ExtractionDiagnostics,
  MetadataConfidence,
  MetadataProvider,
  ResolvedSourceMetadata,
} from "@/lib/metadata/types";
import {
  needsMetadataReview,
  provenanceValue,
} from "@/lib/metadata/provenance";

type JsonLd = Record<string, unknown>;

function text(value: unknown) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function values(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function jsonLdName(value: unknown): CitationName | undefined {
  if (typeof value === "string") return parseCitationName(value);
  if (!value || typeof value !== "object") return undefined;
  const person = value as JsonLd;
  const kind = values(person["@type"]).map(String).join(" ");
  const given = text(person.givenName) || undefined;
  const family = text(person.familyName) || undefined;
  const literal = text(person.name) || undefined;
  if (/Organization|Corporation|GovernmentOrganization/i.test(kind))
    return literal ? { literal } : undefined;
  return given || family
    ? { given, family, suffix: text(person.honorificSuffix) || undefined }
    : literal
      ? parseCitationName(literal)
      : undefined;
}

function flattenJsonLd(root: unknown): JsonLd[] {
  if (Array.isArray(root)) return root.flatMap(flattenJsonLd);
  if (!root || typeof root !== "object") return [];
  const record = root as JsonLd;
  return [
    record,
    ...flattenJsonLd(record["@graph"]),
    ...flattenJsonLd(record.mainEntity),
  ];
}

function scoreJsonLd(item: JsonLd) {
  const kind = values(item["@type"]).join(" ");
  let score = /ScholarlyArticle|Article|NewsArticle|Report|Book|WebPage/i.test(
    kind,
  )
    ? 20
    : 0;
  if (item.headline || item.name) score += 5;
  if (item.author) score += 4;
  if (item.datePublished) score += 3;
  if (item.identifier) score += 2;
  return score;
}

function isoDate(raw: unknown) {
  const date = raw ? new Date(String(raw)) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toISOString().slice(0, 10)
    : "";
}

function sourceAndCslType(structuredType: string, hasJournal: boolean) {
  if (/Report/i.test(structuredType)) return ["Report", "report"] as const;
  if (/Book/i.test(structuredType)) return ["Book", "book"] as const;
  if (
    hasJournal ||
    /Article|NewsArticle|ScholarlyArticle/i.test(structuredType)
  )
    return ["Article", "article-journal"] as const;
  return ["Website", "webpage"] as const;
}

export function extractHtmlMetadata(
  html: string,
  finalUrl: string,
): ResolvedSourceMetadata {
  return extractHtmlMetadataWithDiagnostics(html, finalUrl).metadata;
}

export function extractHtmlMetadataWithDiagnostics(
  html: string,
  finalUrl: string,
): { metadata: ResolvedSourceMetadata; diagnostics: ExtractionDiagnostics } {
  const $ = load(html, { baseURI: finalUrl });
  const metadata = new Map<string, string[]>();
  $("meta").each((_index, element) => {
    const key = ($(element).attr("name") || $(element).attr("property") || "")
      .trim()
      .toLowerCase();
    const value = ($(element).attr("content") || "").trim();
    if (key && value) metadata.set(key, [...(metadata.get(key) ?? []), value]);
  });
  const first = (...names: string[]) =>
    names.flatMap((name) => metadata.get(name.toLowerCase()) ?? [])[0] ?? "";
  const all = (...names: string[]) =>
    names.flatMap((name) => metadata.get(name.toLowerCase()) ?? []);
  const providerFor = (...names: string[]): MetadataProvider | undefined => {
    const key = names.find((name) => metadata.has(name.toLowerCase()));
    if (!key) return undefined;
    const normalized = key.toLowerCase();
    if (normalized.startsWith("citation_")) return "HTML_CITATION_META";
    if (normalized.startsWith("dc.") || normalized.startsWith("dcterms."))
      return "DUBLIN_CORE";
    if (normalized.startsWith("prism.")) return "PRISM";
    if (normalized.startsWith("og:") || normalized.startsWith("article:"))
      return "OPEN_GRAPH";
    return "HTML_GENERIC";
  };
  const confidenceFor = (provider?: MetadataProvider): MetadataConfidence =>
    provider === "HTML_CITATION_META" || provider === "PRISM"
      ? "HIGH"
      : provider === "JSON_LD" || provider === "DUBLIN_CORE"
        ? "MEDIUM"
        : "LOW";

  const structuredItems: JsonLd[] = [];
  $('script[type="application/ld+json" i]').each((_index, element) => {
    try {
      structuredItems.push(...flattenJsonLd(JSON.parse($(element).text())));
    } catch {
      // Invalid JSON-LD is common and should not invalidate other metadata.
    }
  });
  const structured =
    structuredItems.sort((a, b) => scoreJsonLd(b) - scoreJsonLd(a))[0] ?? {};
  const structuredType = values(structured["@type"]).join(" ");

  const structuredAuthors = values(structured.author)
    .map(jsonLdName)
    .filter((name): name is CitationName => Boolean(name));
  const metaAuthors = [
    ...all(
      "citation_author",
      "dc.creator",
      "dc.contributor.author",
      "parsely-author",
    ),
    ...first("author").split(/\s*;\s*|\s+and\s+/i),
  ]
    .map(parseCitationName)
    .filter((name) => name.literal || name.given || name.family);
  const authors = [
    ...new Map(
      [...structuredAuthors, ...metaAuthors].map((name) => [
        displayCitationNames([name]).toLowerCase(),
        name,
      ]),
    ).values(),
  ];

  const canonicalRaw = $("link[rel~='canonical' i]").first().attr("href");
  let canonicalUrl = finalUrl;
  try {
    if (canonicalRaw) canonicalUrl = new URL(canonicalRaw, finalUrl).toString();
  } catch {
    // Retain the fetched URL when a site publishes an invalid canonical link.
  }
  const containerTitle =
    first("citation_journal_title", "citation_conference_title") ||
    text((structured.isPartOf as JsonLd | undefined)?.name);
  const [sourceType, cslType] = sourceAndCslType(
    structuredType,
    Boolean(containerTitle),
  );
  const title =
    first("citation_title", "dc.title", "og:title", "twitter:title") ||
    text(structured.headline || structured.name) ||
    $("title").first().text().trim();
  const publisherValue = structured.publisher;
  const organization =
    text(
      publisherValue && typeof publisherValue === "object"
        ? (publisherValue as JsonLd).name
        : publisherValue,
    ) ||
    first(
      "citation_publisher",
      "dc.publisher",
      "og:site_name",
      "application-name",
    );
  const date = isoDate(
    structured.datePublished ||
      first(
        "citation_publication_date",
        "citation_online_date",
        "citation_date",
        "article:published_time",
        "dc.date",
        "datepublished",
        "date",
      ) ||
      structured.dateCreated,
  );
  const doi = detectDoi(
    first("citation_doi", "dc.identifier", "dc.identifier.doi", "prism.doi"),
    structured.identifier,
    structured.sameAs,
    structured["@id"],
    $("a[href*='doi.org/']").first().attr("href"),
    finalUrl,
  );
  const firstPage = first("citation_firstpage", "prism.startingpage");
  const lastPage = first("citation_lastpage", "prism.endingpage");
  const pages =
    firstPage && lastPage
      ? `${firstPage}-${lastPage}`
      : firstPage || first("citation_pages") || text(structured.pagination);
  const citationData: NormalizedCitationData = {
    title,
    type: cslType,
    authors,
    editors: values(structured.editor)
      .map(jsonLdName)
      .filter((name): name is CitationName => Boolean(name)),
    translators: values(structured.translator)
      .map(jsonLdName)
      .filter((name): name is CitationName => Boolean(name)),
    containerTitle,
    volume:
      first("citation_volume", "prism.volume") || text(structured.volumeNumber),
    issue:
      first("citation_issue", "prism.number") || text(structured.issueNumber),
    pages,
    edition: first("citation_edition") || text(structured.bookEdition),
    publisher: organization,
    publisherPlace: first("citation_publisher_place"),
    issued: toCitationDate(date),
    accessed: toCitationDate(new Date()),
    url: canonicalUrl,
    doi,
    isbn: [
      ...new Set([
        ...all("citation_isbn"),
        ...values(structured.isbn).map(text),
      ]),
    ],
    issn: [
      ...new Set([
        ...all("citation_issn", "prism.issn"),
        ...values(structured.issn).map(text),
      ]),
    ],
    language:
      first("citation_language", "dc.language") || text(structured.inLanguage),
    abstract:
      first(
        "description",
        "dc.description",
        "og:description",
        "twitter:description",
      ) || text(structured.description),
  };
  const result: ResolvedSourceMetadata = {
    title,
    authors: authors.map((author) => displayCitationNames([author])),
    organization,
    date,
    url: canonicalUrl,
    canonicalUrl,
    doi,
    type: sourceType,
    description: citationData.abstract || "",
    containerTitle,
    volume: citationData.volume,
    issue: citationData.issue,
    pages,
    citationData,
    provenance: {},
    metadataNeedsReview: false,
  };
  const authorsProvider = all("citation_author").length
    ? "HTML_CITATION_META"
    : structuredAuthors.length
      ? "JSON_LD"
      : all("dc.creator", "dc.contributor.author").length
        ? "DUBLIN_CORE"
        : "HTML_GENERIC";
  const titleProvider =
    providerFor("citation_title", "dc.title", "og:title", "twitter:title") ||
    (structured.headline || structured.name ? "JSON_LD" : "HTML_GENERIC");
  const dateProvider = structured.datePublished
    ? "JSON_LD"
    : providerFor(
        "citation_publication_date",
        "citation_online_date",
        "citation_date",
        "article:published_time",
        "dc.date",
        "datepublished",
        "date",
      ) || (structured.dateCreated ? "JSON_LD" : undefined);
  const containerProvider = providerFor(
    "citation_journal_title",
    "citation_conference_title",
  ) || (containerTitle ? "JSON_LD" : undefined);
  const publisherProvider = structured.publisher
    ? "JSON_LD"
    : providerFor(
        "citation_publisher",
        "dc.publisher",
        "og:site_name",
        "application-name",
      );
  const set = (
    field: keyof typeof result.provenance,
    value: unknown,
    provider?: MetadataProvider,
  ) => {
    if (value === undefined || value === "" || (Array.isArray(value) && !value.length))
      return;
    const selectedProvider = provider ?? "HTML_GENERIC";
    result.provenance[field] = provenanceValue(
      value,
      selectedProvider,
      confidenceFor(selectedProvider),
    );
  };
  set("title", title, titleProvider);
  set("authors", citationData.authors, authorsProvider);
  set("editors", citationData.editors, structured.editor ? "JSON_LD" : undefined);
  set("translators", citationData.translators, structured.translator ? "JSON_LD" : undefined);
  set("publisher", organization, publisherProvider);
  set("publicationDate", date, dateProvider);
  set("accessedDate", citationData.accessed, "URL_INFERENCE");
  set("containerTitle", containerTitle, containerProvider);
  set("volume", citationData.volume, providerFor("citation_volume", "prism.volume") || (structured.volumeNumber ? "JSON_LD" : undefined));
  set("issue", citationData.issue, providerFor("citation_issue", "prism.number") || (structured.issueNumber ? "JSON_LD" : undefined));
  set("pages", pages, providerFor("citation_firstpage", "prism.startingpage", "citation_pages") || (structured.pagination ? "JSON_LD" : undefined));
  set("edition", citationData.edition, providerFor("citation_edition") || (structured.bookEdition ? "JSON_LD" : undefined));
  set("publisherPlace", citationData.publisherPlace, providerFor("citation_publisher_place"));
  set("doi", doi, providerFor("citation_doi", "dc.identifier", "dc.identifier.doi", "prism.doi") || (structured.identifier ? "JSON_LD" : "URL_INFERENCE"));
  set("isbn", citationData.isbn, providerFor("citation_isbn") || (structured.isbn ? "JSON_LD" : undefined));
  set("issn", citationData.issn, providerFor("citation_issn", "prism.issn") || (structured.issn ? "JSON_LD" : undefined));
  set("language", citationData.language, providerFor("citation_language", "dc.language") || (structured.inLanguage ? "JSON_LD" : undefined));
  set("description", citationData.abstract, providerFor("dc.description", "og:description", "description") || (structured.description ? "JSON_LD" : undefined));
  set("url", canonicalUrl, canonicalRaw ? "HTML_GENERIC" : "URL_INFERENCE");
  set("sourceType", sourceType, structuredType ? "JSON_LD" : containerTitle ? "HTML_CITATION_META" : "URL_INFERENCE");
  result.metadataNeedsReview = needsMetadataReview(result.provenance);
  const keys = [...metadata.keys()];
  return {
    metadata: result,
    diagnostics: {
      htmlTitle: $("title").first().text().trim() || undefined,
      citationMetaTags: keys.filter((key) => key.startsWith("citation_")).length,
      dublinCoreMetaTags: keys.filter(
        (key) => key.startsWith("dc.") || key.startsWith("dcterms."),
      ).length,
      openGraphMetaTags: keys.filter(
        (key) => key.startsWith("og:") || key.startsWith("article:"),
      ).length,
      prismMetaTags: keys.filter((key) => key.startsWith("prism.")).length,
      jsonLdObjects: structuredItems.length,
      canonicalUrl: canonicalRaw ? canonicalUrl : undefined,
      detectedDoi: doi,
      crossrefAttempted: false,
      crossrefSucceeded: false,
    },
  };
}
