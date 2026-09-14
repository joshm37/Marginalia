import { beforeEach, describe, expect, it, vi } from "vitest";

const pdfMock = vi.hoisted(() => ({ corrupted: false }));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: () => ({
    destroy: vi.fn().mockResolvedValue(undefined),
    promise: pdfMock.corrupted
      ? Promise.reject(new Error("invalid pdf"))
      : Promise.resolve({
          numPages: 2,
          getMetadata: async () => ({
            info: {
              Title: "Local research article",
              Author: "Ada Lovelace; World Health Organization",
              Subject: "A useful abstract",
              Keywords: "research, testing",
              CreationDate: "D:20250102090000Z",
            },
          }),
          getPage: async (page: number) => ({
            getTextContent: async () => ({
              items: page === 1
                ? [{ str: "doi: 10.1234/local.test" }]
                : [{ str: "ISBN 978-0-306-40615-7" }],
            }),
            cleanup: vi.fn(),
          }),
          cleanup: vi.fn(),
        }),
  }),
}));

import { extractLocalPdfMetadata } from "@/lib/local-documents/pdf-metadata";

describe("local PDF metadata extraction", () => {
  beforeEach(() => { pdfMock.corrupted = false; });

  it("extracts metadata and identifier enrichment inputs locally", async () => {
    const result = await extractLocalPdfMetadata(
      new File(["%PDF-1.7"], "paper.pdf", { type: "application/pdf" }),
    );
    expect(result).toMatchObject({
      title: "Local research article",
      authors: ["Ada Lovelace", "World Health Organization"],
      creationDate: "2025-01-02",
      pageCount: 2,
      doi: "10.1234/local.test",
      isbn: "9780306406157",
    });
    expect(result.provenance.title?.provider).toBe("PDF_METADATA");
  });

  it("reports a corrupted or unreadable PDF", async () => {
    pdfMock.corrupted = true;
    await expect(
      extractLocalPdfMetadata(new File(["bad"], "bad.pdf", { type: "application/pdf" })),
    ).rejects.toThrow("corrupted, encrypted, or unreadable");
  });
});
