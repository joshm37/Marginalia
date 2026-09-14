export const citationStyles = [
  { id: "apa-7", name: "APA 7th edition", template: "apa", category: "author-date", locale: "en-US", builtIn: true },
  { id: "mla-9", name: "MLA 9th edition", template: "marginalia-mla-9", category: "author-date", locale: "en-US", builtIn: false },
  { id: "chicago-notes", name: "Chicago Notes & Bibliography", template: "marginalia-chicago-18-notes-bibliography", category: "notes", locale: "en-US", builtIn: false },
  { id: "chicago-author-date", name: "Chicago Author-Date", template: "chicago-author-date", category: "author-date", locale: "en-US", builtIn: false },
  { id: "harvard", name: "Harvard — Cite Them Right", template: "harvard", category: "author-date", locale: "en-GB", builtIn: false },
  { id: "ieee", name: "IEEE", template: "ieee", category: "numeric", locale: "en-US", builtIn: false },
  { id: "vancouver", name: "Vancouver", template: "vancouver", category: "numeric", locale: "en-US", builtIn: true },
  { id: "ama", name: "AMA 11th edition", template: "ama", category: "numeric", locale: "en-US", builtIn: false },
  { id: "acs", name: "American Chemical Society", template: "marginalia-acs", category: "numeric", locale: "en-US", builtIn: false },
  { id: "nature", name: "Nature", template: "nature", category: "numeric", locale: "en-US", builtIn: false },
] as const;
export type CitationStyle = (typeof citationStyles)[number]["id"];
export const defaultCitationStyle: CitationStyle = "apa-7";
export const citationStyleIds = citationStyles.map((style) => style.id) as [CitationStyle, ...CitationStyle[]];
export function getCitationStyle(id: CitationStyle) { return citationStyles.find((style) => style.id === id)!; }
