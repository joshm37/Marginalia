import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Cite, plugins } from "@citation-js/core";
import "@citation-js/plugin-csl";
import { normalizedCitationToCsl } from "@/lib/citations/normalized";
import type {
  CitationEngine,
  CitationStyle,
  NormalizedCitationData,
} from "@/lib/citations/types";

const styleNames: Record<CitationStyle, string> = {
  APA: "apa",
  MLA: "marginalia-mla-9",
  Chicago: "marginalia-chicago-18-notes-bibliography",
};

let registered = false;
const formattedCache = new Map<string, string>();
const MAX_FORMATTED_CACHE = 500;
function registerStyles() {
  if (registered) return;
  const styles = plugins.config.get("@csl").styles;
  styles.add(
    styleNames.MLA,
    readFileSync(
      path.join(
        process.cwd(),
        "lib/citations/styles/modern-language-association.csl",
      ),
      "utf8",
    ),
  );
  styles.add(
    styleNames.Chicago,
    readFileSync(
      path.join(
        process.cwd(),
        "lib/citations/styles/chicago-notes-bibliography.csl",
      ),
      "utf8",
    ),
  );
  registered = true;
}

export class CitationJsEngine implements CitationEngine {
  formatBibliography(data: NormalizedCitationData, style: CitationStyle) {
    registerStyles();
    const cacheKey = `${style}:${JSON.stringify(data)}`;
    const cached = formattedCache.get(cacheKey);
    if (cached) return cached;
    const cite = new Cite(normalizedCitationToCsl(data));
    const formatted = String(
      cite.format("bibliography", {
        format: "text",
        template: styleNames[style],
        lang: "en-US",
      }),
    ).trim();
    if (formattedCache.size >= MAX_FORMATTED_CACHE) {
      const oldest = formattedCache.keys().next().value;
      if (oldest) formattedCache.delete(oldest);
    }
    formattedCache.set(cacheKey, formatted);
    return formatted;
  }
}

export const citationEngine: CitationEngine = new CitationJsEngine();
