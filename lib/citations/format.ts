import "server-only";
import { citationEngine } from "@/lib/citations/citation-js-engine";
import { sourceToNormalizedCitation } from "@/lib/citations/normalized";
import type { CitationStyle } from "@/lib/citations/types";
import type { Source } from "@/lib/types";

export type { CitationStyle } from "@/lib/citations/types";

export function formatCitation(source: Source, style: CitationStyle) {
  return citationEngine.formatBibliography(
    sourceToNormalizedCitation(source),
    style,
  );
}
