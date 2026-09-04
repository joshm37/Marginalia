import type { Source } from "@/lib/types";
import { sourceToNormalizedCitation } from "@/lib/citations/normalized";
import type { CitationName, NormalizedCitationData } from "@/lib/citations/types";

function names(values: CitationName[] = []) {
  return values
    .map((name) =>
      name.literal
        ? `{${name.literal}}`
        : [name.family, name.given].filter(Boolean).join(", "),
    )
    .filter(Boolean)
    .join(" and ");
}

function issuedYear(data: NormalizedCitationData) {
  return data.issued?.["date-parts"]?.[0]?.[0]?.toString();
}

function bibtexEscape(value: string) {
  return value.replace(/[{}]/g, (character) => `\\${character}`);
}

function bibtexType(type: string) {
  if (type === "article-journal") return "article";
  if (type === "book") return "book";
  if (type === "report") return "techreport";
  return "misc";
}

function citeKey(data: NormalizedCitationData, index: number) {
  const first = data.authors[0];
  const author = first?.family || first?.literal || "source";
  return `${author}${issuedYear(data) || "nd"}${index + 1}`
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

export function sourcesToBibtex(sources: Source[]) {
  return sources
    .map((source, index) => {
      const data = sourceToNormalizedCitation(source);
      const fields: Array<[string, string | undefined]> = [
        ["title", data.title],
        ["author", names(data.authors)],
        ["editor", names(data.editors)],
        ["year", issuedYear(data)],
        ["journal", data.containerTitle],
        ["volume", data.volume],
        ["number", data.issue],
        ["pages", data.pages],
        ["publisher", data.publisher],
        ["address", data.publisherPlace],
        ["edition", data.edition],
        ["doi", data.doi],
        ["url", data.url],
        ["isbn", data.isbn?.join(", ")],
        ["issn", data.issn?.join(", ")],
        [
          "annote",
          source.includeInBibliography !== false
            ? source.bibliographyAnnotation?.trim()
            : undefined,
        ],
      ];
      const body = fields
        .filter((field): field is [string, string] => Boolean(field[1]))
        .map(([key, value]) => `  ${key} = {${bibtexEscape(value)}}`)
        .join(",\n");
      return `@${bibtexType(data.type)}{${citeKey(data, index)},\n${body}\n}`;
    })
    .join("\n\n");
}

function risType(type: string) {
  if (type === "article-journal") return "JOUR";
  if (type === "book") return "BOOK";
  if (type === "report") return "RPRT";
  if (type === "webpage") return "ELEC";
  if (type === "legal_case" || type === "bill") return "LEGAL";
  return "GEN";
}

function risName(name: CitationName) {
  return name.literal || [name.family, name.given].filter(Boolean).join(", ");
}

export function sourcesToRis(sources: Source[]) {
  return sources
    .map((source) => {
      const data = sourceToNormalizedCitation(source);
      const rows = [
        `TY  - ${risType(data.type)}`,
        `TI  - ${data.title}`,
        ...data.authors.map((author) => `AU  - ${risName(author)}`),
        ...data.editors?.map((editor) => `ED  - ${risName(editor)}`) ?? [],
        ...(issuedYear(data) ? [`PY  - ${issuedYear(data)}`] : []),
        ...(data.containerTitle ? [`JO  - ${data.containerTitle}`] : []),
        ...(data.volume ? [`VL  - ${data.volume}`] : []),
        ...(data.issue ? [`IS  - ${data.issue}`] : []),
        ...(data.pages ? [`SP  - ${data.pages}`] : []),
        ...(data.publisher ? [`PB  - ${data.publisher}`] : []),
        ...(data.doi ? [`DO  - ${data.doi}`] : []),
        ...(data.url ? [`UR  - ${data.url}`] : []),
        ...(source.includeInBibliography !== false && source.bibliographyAnnotation?.trim()
          ? [`N1  - ${source.bibliographyAnnotation.trim()}`]
          : []),
        "ER  - ",
      ];
      return rows.join("\n");
    })
    .join("\n\n");
}
