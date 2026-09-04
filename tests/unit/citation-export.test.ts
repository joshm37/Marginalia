import { describe, expect, it } from "vitest";
import { sourcesToBibtex, sourcesToRis } from "@/lib/citations/export";
import type { Source } from "@/lib/types";

const source: Source = {
  id: "source-1",
  title: "A Useful Article",
  authors: "Doe, Jane and Example Institute",
  organization: "Research Press",
  date: "2025-03-14",
  url: "https://example.com/article",
  doi: "10.1000/example",
  containerTitle: "Journal of Examples",
  volume: "12",
  issue: "3",
  pages: "10-22",
  type: "Article",
  description: "",
  bibliographyAnnotation: "A concise assessment of the evidence.",
  includeInBibliography: true,
  tags: [],
  projects: ["project-1"],
  notes: "",
  createdAt: "2025-03-14",
};

describe("citation exchange exports", () => {
  it("serializes source metadata and annotations as BibTeX", () => {
    const result = sourcesToBibtex([source]);
    expect(result).toContain("@article{");
    expect(result).toContain("title = {A Useful Article}");
    expect(result).toContain("doi = {10.1000/example}");
    expect(result).toContain("annote = {A concise assessment of the evidence.}");
  });

  it("serializes source metadata and annotations as RIS", () => {
    const result = sourcesToRis([source]);
    expect(result).toContain("TY  - JOUR");
    expect(result).toContain("TI  - A Useful Article");
    expect(result).toContain("DO  - 10.1000/example");
    expect(result).toContain("N1  - A concise assessment of the evidence.");
    expect(result).toContain("ER  - ");
  });
});
