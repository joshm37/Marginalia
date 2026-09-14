export type PdfTextAnchor = {
  version: 1;
  kind: "PDF_TEXT_QUOTE";
  pageNumber: string;
  exact: string;
  prefix: string;
  suffix: string;
  textStart?: number;
  textEnd?: number;
  rect?: { x: number; y: number; width: number; height: number };
};

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function createPdfTextAnchor(
  pageText: string,
  selectedText: string,
  pageNumber: number,
  rect?: PdfTextAnchor["rect"],
): PdfTextAnchor {
  const text = normalize(pageText);
  const exact = normalize(selectedText);
  const start = text.indexOf(exact);
  return {
    version: 1,
    kind: "PDF_TEXT_QUOTE",
    pageNumber: String(pageNumber),
    exact,
    prefix: start >= 0 ? text.slice(Math.max(0, start - 160), start) : "",
    suffix: start >= 0 ? text.slice(start + exact.length, start + exact.length + 160) : "",
    ...(start >= 0 ? { textStart: start, textEnd: start + exact.length } : {}),
    ...(rect ? { rect } : {}),
  };
}

export function reanchorPdfText(pageText: string, anchor: Pick<PdfTextAnchor, "exact" | "prefix" | "suffix" | "textStart">) {
  const text = normalize(pageText);
  const exact = normalize(anchor.exact);
  if (!exact) return null;
  if (typeof anchor.textStart === "number" && text.slice(anchor.textStart, anchor.textStart + exact.length) === exact)
    return { start: anchor.textStart, end: anchor.textStart + exact.length };
  const matches: number[] = [];
  for (let at = text.indexOf(exact); at >= 0; at = text.indexOf(exact, at + 1)) matches.push(at);
  if (!matches.length) return null;
  if (matches.length === 1) return { start: matches[0], end: matches[0] + exact.length };
  const prefix = normalize(anchor.prefix);
  const suffix = normalize(anchor.suffix);
  const ranked = matches.map((start) => {
    const before = text.slice(Math.max(0, start - prefix.length - 8), start);
    const after = text.slice(start + exact.length, start + exact.length + suffix.length + 8);
    let score = 0;
    if (prefix && before.trimEnd().endsWith(prefix)) score += prefix.length * 2;
    if (suffix && after.trimStart().startsWith(suffix)) score += suffix.length * 2;
    for (let index = 1; index <= Math.min(prefix.length, before.length); index += 1)
      if (prefix.at(-index) === before.at(-index)) score += 1;
      else break;
    for (let index = 0; index < Math.min(suffix.length, after.length); index += 1)
      if (suffix[index] === after[index]) score += 1;
      else break;
    return { start, score };
  }).sort((a, b) => b.score - a.score);
  return { start: ranked[0].start, end: ranked[0].start + exact.length };
}
