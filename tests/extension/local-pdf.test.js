import { describe, it, expect, vi } from "vitest";
import { classifyCapture, captureLocalPdf } from "../../extension/local-pdf.js";
import { sha256File } from "../../lib/local-documents/hash";
import { validateLocalPdf, configuredMaxLocalPdfBytes } from "../../lib/local-documents/validation";

describe("local PDF extension capture", () => {
  it.each([
    ["file:///Users/josht/Downloads/test-paper.pdf", "LOCAL_PDF"],
    ["https://example.com/paper.pdf", "REMOTE_PDF"],
    ["https://example.com/article", "WEB_PAGE"],
    ["file:///Users/josht/test.txt", "UNSUPPORTED"],
    ["chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/index.html", "UNSUPPORTED"],
  ])("classifies %s as %s", (url, type) => {
    expect(classifyCapture({ url, title: "test-paper.pdf" }).type).toBe(type);
  });
  it("stops before reading or calling an API when file access is disabled", async () => {
    const fetchFile = vi.fn();
    await expect(captureLocalPdf(classifyCapture({ url: "file:///Users/josht/Downloads/test-paper.pdf" }), {
      allowed: async () => false, fetchFile, loadUtilities: vi.fn(),
    })).rejects.toThrow("Allow access to file URLs");
    expect(fetchFile).not.toHaveBeenCalled();
  });
  it("creates safe LOCAL identity using shared hashing and retains DOI metadata", async () => {
    const result = await captureLocalPdf(classifyCapture({ url: "file:///Users/josht/Downloads/test%20%C3%A9.pdf" }), {
      allowed: async () => true,
      fetchFile: async () => new Response("%PDF-1.7\nfixture"),
      loadUtilities: async () => ({ sha256File, validateLocalPdf, configuredMaxLocalPdfBytes,
        extractLocalPdfMetadata: async () => ({ title: "Paper", authors: ["A Researcher"], doi: "10.1234/test", pageCount: 1, provenance: {} }),
      }),
    });
    expect(result).toMatchObject({ storageMode: "LOCAL", doi: "10.1234/test", localFile: { filename: "test é.pdf", mimeType: "application/pdf" } });
    expect(result.localFile.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.localFile.lastModified).toBeUndefined();
    expect(result.url).toBeUndefined();
    expect(result.canonicalUrl).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("file:");
    expect(JSON.stringify(result)).not.toContain("/Users/");
  });
});
