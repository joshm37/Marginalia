import { describe, expect, it } from "vitest";
import { createPdfTextAnchor, reanchorPdfText } from "@/lib/local-documents/excerpt-anchor";

describe("PDF excerpt anchors", () => {
  const page = "Introduction Earlier evidence was limited. The central finding supports the hypothesis. Later work confirmed it.";

  it("persists page, exact text, prefix, and suffix", () => {
    const anchor = createPdfTextAnchor(page, "The central finding supports the hypothesis.", 12);
    expect(anchor).toMatchObject({
      version: 1,
      kind: "PDF_TEXT_QUOTE",
      pageNumber: "12",
      exact: "The central finding supports the hypothesis.",
    });
    expect(anchor.prefix).toContain("Earlier evidence");
    expect(anchor.suffix).toContain("Later work");
  });

  it("re-anchors after harmless whitespace changes", () => {
    const anchor = createPdfTextAnchor(page, "The central finding supports the hypothesis.", 12);
    expect(reanchorPdfText(page.replaceAll(" ", "  \n"), anchor)).toEqual({
      start: anchor.textStart,
      end: anchor.textEnd,
    });
  });

  it("uses context to disambiguate repeated exact text", () => {
    const text = "First context repeated passage first ending. Second context repeated passage correct ending.";
    const anchor = createPdfTextAnchor(text, "repeated passage", 3);
    const secondStart = text.lastIndexOf("repeated passage");
    const moved = { ...anchor, textStart: undefined, prefix: "Second context ", suffix: " correct ending." };
    expect(reanchorPdfText(text, moved)?.start).toBe(secondStart);
  });

  it("returns null so the reader can fall back to the page and side panel", () => {
    expect(reanchorPdfText(page, { exact: "text no longer present", prefix: "", suffix: "" })).toBeNull();
  });
});
