import { describe, expect, it } from "vitest";
import { hangingPlainText, hangingRichTextHtml, normalizeCitationHtml, normalizeCitationText } from "@/lib/client/citation-output";

describe("citation output indentation", () => {
  it("removes CSL layout whitespace without joining separate entry wrappers", () => {
    expect(normalizeCitationText("  Doe, J.\n   A useful article.  ")).toBe("Doe, J. A useful article.");
    expect(normalizeCitationHtml('<div class="csl-entry"><div class="csl-left-margin">1.</div><div class="csl-right-inline"><i>Title</i></div></div>')).toBe("1.<i>Title</i>");
  });

  it("applies a fresh hanging indent to every plain-text entry", () => {
    const first = hangingPlainText("One two three four five six seven", 20, "    ");
    const second = hangingPlainText("Alpha beta gamma delta epsilon", 20, "    ");
    expect(first.split("\n")[0].startsWith(" ")).toBe(false);
    expect(first.split("\n")[1].startsWith("    ")).toBe(true);
    expect(second.split("\n")[0].startsWith(" ")).toBe(false);
  });

  it("uses one non-compounding hanging indent for rich text", () => {
    const html = hangingRichTextHtml("<i>Journal title</i>, 12, 4–20.");
    expect(html).toContain("padding-left:36pt;text-indent:-36pt");
    expect(html.match(/padding-left/g)).toHaveLength(1);
  });
});
