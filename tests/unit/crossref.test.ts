import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCrossrefCache,
  enrichDoiWithCrossref,
} from "@/lib/metadata/crossref";

describe("Crossref DOI enrichment", () => {
  beforeEach(() => clearCrossrefCache());

  it("maps authoritative work metadata and caches repeated DOI requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: {
            type: "journal-article",
            title: ["Authoritative title"],
            author: [{ given: "Octavia", family: "Butler" }],
            "container-title": ["Research Journal"],
            volume: "8",
            issue: "2",
            page: "10-19",
            DOI: "10.5555/Example",
            issued: { "date-parts": [[2025, 7, 4]] },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const first = await enrichDoiWithCrossref(
      "https://doi.org/10.5555/EXAMPLE",
    );
    const second = await enrichDoiWithCrossref("doi:10.5555/example");
    expect(first).toMatchObject({
      title: "Authoritative title",
      type: "article-journal",
      authors: [{ given: "Octavia", family: "Butler" }],
      containerTitle: "Research Journal",
      doi: "10.5555/example",
    });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("fails softly when Crossref is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(enrichDoiWithCrossref("10.5555/offline")).resolves.toBeNull();
  });
});
