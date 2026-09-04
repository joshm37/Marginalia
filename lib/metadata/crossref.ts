import "server-only";
import { normalizeDoi } from "@/lib/citations/identifiers";
import { toCitationDate } from "@/lib/citations/normalized";
import type {
  CitationName,
  NormalizedCitationData,
} from "@/lib/citations/types";

const CACHE_TTL = 24 * 60 * 60 * 1000;
const cache = new Map<
  string,
  { expires: number; value: NormalizedCitationData | null; failureReason?: string }
>();

export type CrossrefEnrichmentResult = {
  data: NormalizedCitationData | null;
  attempted: boolean;
  succeeded: boolean;
  cacheHit: boolean;
  failureReason?: string;
};

type CrossrefPerson = {
  given?: string;
  family?: string;
  name?: string;
  suffix?: string;
};
type CrossrefWork = {
  title?: string[];
  subtitle?: string[];
  type?: string;
  author?: CrossrefPerson[];
  editor?: CrossrefPerson[];
  translator?: CrossrefPerson[];
  "container-title"?: string[];
  "short-container-title"?: string[];
  publisher?: string;
  "publisher-location"?: string;
  volume?: string;
  issue?: string;
  page?: string;
  edition?: string;
  DOI?: string;
  URL?: string;
  ISBN?: string[];
  ISSN?: string[];
  language?: string;
  abstract?: string;
  issued?: { "date-parts"?: number[][] };
  published?: { "date-parts"?: number[][] };
  created?: { "date-time"?: string };
};

function people(values?: CrossrefPerson[]): CitationName[] | undefined {
  const result = values
    ?.map((person) => ({
      ...(person.name ? { literal: person.name } : {}),
      ...(person.given ? { given: person.given } : {}),
      ...(person.family ? { family: person.family } : {}),
      ...(person.suffix ? { suffix: person.suffix } : {}),
    }))
    .filter((person) => person.literal || person.family || person.given);
  return result?.length ? result : undefined;
}

function text(value?: string) {
  return value
    ?.replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function type(value?: string) {
  if (value === "journal-article") return "article-journal";
  if (value === "book" || value === "monograph" || value === "edited-book")
    return "book";
  if (value?.includes("report")) return "report";
  if (value === "proceedings-article") return "paper-conference";
  return "document";
}

export async function enrichDoiWithCrossref(
  rawDoi?: string,
): Promise<NormalizedCitationData | null> {
  return (await enrichDoiWithCrossrefDetailed(rawDoi)).data;
}

export async function enrichDoiWithCrossrefDetailed(
  rawDoi?: string,
): Promise<CrossrefEnrichmentResult> {
  const doi = normalizeDoi(rawDoi);
  if (!doi)
    return { data: null, attempted: false, succeeded: false, cacheHit: false };
  const cached = cache.get(doi);
  if (cached && cached.expires > Date.now())
    return {
      data: cached.value,
      attempted: true,
      succeeded: Boolean(cached.value),
      cacheHit: true,
      failureReason: cached.failureReason,
    };
  try {
    const mailto = process.env.CROSSREF_MAILTO;
    const query = mailto ? `?mailto=${encodeURIComponent(mailto)}` : "";
    const response = await fetch(
      `https://api.crossref.org/works/${encodeURIComponent(doi)}${query}`,
      {
        signal: AbortSignal.timeout(4_000),
        headers: {
          Accept: "application/json",
          "User-Agent": `Marginalia/1.0 (citation metadata; mailto:${mailto ?? "support@example.invalid"})`,
        },
        cache: "no-store",
      },
    );
    if (!response.ok) throw new Error(`Crossref returned ${response.status}`);
    const work = ((await response.json()) as { message: CrossrefWork }).message;
    const issuedParts =
      work.issued?.["date-parts"] ?? work.published?.["date-parts"];
    const value: NormalizedCitationData = {
      title:
        text(
          [...(work.title ?? []), ...(work.subtitle ?? [])]
            .filter(Boolean)
            .join(": "),
        ) ?? "",
      type: type(work.type),
      authors: people(work.author) ?? [],
      editors: people(work.editor),
      translators: people(work.translator),
      containerTitle: text(work["container-title"]?.[0]),
      volume: work.volume,
      issue: work.issue,
      pages: work.page,
      edition: work.edition,
      publisher: text(work.publisher),
      publisherPlace: text(work["publisher-location"]),
      issued: issuedParts?.length
        ? { "date-parts": issuedParts }
        : toCitationDate(work.created?.["date-time"]),
      url: work.URL,
      doi,
      isbn: work.ISBN,
      issn: work.ISSN,
      language: work.language,
      abstract: text(work.abstract),
    };
    cache.set(doi, { expires: Date.now() + CACHE_TTL, value });
    return { data: value, attempted: true, succeeded: true, cacheHit: false };
  } catch (error) {
    const failureReason =
      error instanceof Error ? error.message : "Crossref request failed";
    cache.set(doi, {
      expires: Date.now() + 5 * 60 * 1000,
      value: null,
      failureReason,
    });
    return {
      data: null,
      attempted: true,
      succeeded: false,
      cacheHit: false,
      failureReason,
    };
  }
}

export function clearCrossrefCache() {
  cache.clear();
}
