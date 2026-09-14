import { normalizeDoi } from "@/lib/citations/identifiers";
import type { IdentifierSet } from "@/lib/metadata/providers/types";

function strings(values: unknown[]) {
  const pending = [...values];
  const result: string[] = [];
  while (pending.length) {
    const value = pending.shift();
    if (Array.isArray(value)) pending.push(...value);
    else if (value && typeof value === "object")
      pending.push(...Object.values(value));
    else if (value != null) result.push(String(value));
  }
  return result;
}

export function normalizeIsbn(value?: string) {
  const isbn = value?.toUpperCase().replace(/[^0-9X]/g, "");
  return isbn && (isbn.length === 10 || isbn.length === 13) ? isbn : undefined;
}

export function detectIdentifierSet(...values: unknown[]): IdentifierSet {
  const text = strings(values);
  const combined = text.join(" ");
  const doi = normalizeDoi(
    combined.match(/10\.\d{4,9}\/[\w.()/:+-]+/i)?.[0]?.replace(/[.,;]+$/, ""),
  );
  const pmcid = combined.match(/\bPMC\s*:?\s*(\d{4,10})\b/i)?.[1];
  const pmid =
    combined.match(/\bPMID\s*:?\s*(\d{4,10})\b/i)?.[1] ??
    combined.match(/pubmed(?:\.ncbi\.nlm\.nih\.gov)?\/(\d{4,10})/i)?.[1];
  const openAlexId = combined.match(/\bW\d{4,15}\b/i)?.[0]?.toUpperCase();
  const isbn = text
    .flatMap((item) => item.match(/(?:97[89][\s-]?)?[0-9][0-9X\s-]{8,16}/gi) ?? [])
    .map(normalizeIsbn)
    .filter((item): item is string => Boolean(item));
  return {
    doi,
    pmid,
    pmcid: pmcid ? `PMC${pmcid}` : undefined,
    isbn: [...new Set(isbn)],
    openAlexId,
  };
}

export function mergeIdentifierSets(...sets: IdentifierSet[]): IdentifierSet {
  return {
    doi: sets.find((item) => item.doi)?.doi,
    pmid: sets.find((item) => item.pmid)?.pmid,
    pmcid: sets.find((item) => item.pmcid)?.pmcid,
    openAlexId: sets.find((item) => item.openAlexId)?.openAlexId,
    isbn: [...new Set(sets.flatMap((item) => item.isbn ?? []))],
  };
}
