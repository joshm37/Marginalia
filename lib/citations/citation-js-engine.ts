import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Cite, plugins } from "@citation-js/core";
import "@citation-js/plugin-csl";
import { normalizedCitationToCsl } from "@/lib/citations/normalized";
import { getCitationStyle, type CitationStyle } from "@/lib/citations/style-registry";
import type { CitationEngine, CslJson, NormalizedCitationData } from "@/lib/citations/types";

export type FormattedCitation = { text: string; html: string; id?: string };
type CompiledModule = { bibliography(item: Record<string, unknown>, context?: Record<string, unknown>): FormattedCitation; bibliographySort?(a: Record<string, unknown>, b: Record<string, unknown>): number };
const compiledLoaders: Partial<Record<CitationStyle, () => Promise<CompiledModule>>> = {
  "chicago-author-date": () => import("@citestyle/styles/chicago-author-date"),
  harvard: () => import("@citestyle/styles/harvard"), ieee: () => import("@citestyle/styles/ieee"),
  vancouver: () => import("@citestyle/styles/vancouver"), ama: () => import("@citestyle/styles/ama"),
  nature: () => import("@citestyle/styles/nature"),
};
const cslFiles: Partial<Record<CitationStyle, string>> = { "mla-9": "modern-language-association.csl", "chicago-notes": "chicago-notes-bibliography.csl", acs: "american-chemical-society.csl" };
const registered = new Set<CitationStyle>();
function registerCsl(style: CitationStyle) {
  const filename = cslFiles[style];
  if (!filename || registered.has(style)) return;
  plugins.config.get("@csl").styles.add(getCitationStyle(style).template, readFileSync(path.join(process.cwd(), "lib/citations/styles", filename), "utf8"));
  registered.add(style);
}
function cleanHtml(html: string) { return html.trim().replace(/^<div class="csl-bib-body">\s*|\s*<\/div>$/g, "").replace(/^<div class="csl-entry">\s*|\s*<\/div>$/g, ""); }

export class CitationJsEngine implements CitationEngine {
  async format(data: NormalizedCitationData, style: CitationStyle, number = 1, id?: string): Promise<FormattedCitation> {
    const csl = normalizedCitationToCsl(data, id) as CslJson & { "citation-number"?: number };
    csl["citation-number"] = number;
    const loader = compiledLoaders[style];
    if (loader) return { ...(await loader()).bibliography(csl as Record<string, unknown>, { citationNumber: number }), id: csl.id };
    registerCsl(style);
    const cite = new Cite(csl);
    const options = { template: getCitationStyle(style).template, lang: getCitationStyle(style).locale };
    return { id: csl.id, text: String(cite.format("bibliography", { ...options, format: "text" })).trim(), html: cleanHtml(String(cite.format("bibliography", { ...options, format: "html" }))) };
  }
  async formatBibliography(data: NormalizedCitationData, style: CitationStyle) { return (await this.format(data, style)).text; }
  async formatMany(data: NormalizedCitationData[], style: CitationStyle, ids: string[] = [], sortByStyle = true): Promise<FormattedCitation[]> {
    const loader = compiledLoaders[style];
    const ordered = data.map((item, index) => ({ item, id: ids[index] }));
    if (loader && sortByStyle) { const compiledStyle = await loader(); if (compiledStyle.bibliographySort) ordered.sort((a, b) => compiledStyle.bibliographySort!(normalizedCitationToCsl(a.item, a.id), normalizedCitationToCsl(b.item, b.id))); }
    return Promise.all(ordered.map(({ item, id }, index) => this.format(item, style, index + 1, id)));
  }
}
export const citationEngine = new CitationJsEngine();
