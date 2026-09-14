import { describe, expect, it, vi } from "vitest";
import { matchesFileHash, sha256File } from "@/lib/local-documents/hash";
import { validateLocalPdf } from "@/lib/local-documents/validation";
import { supportsPersistentFileHandles } from "@/lib/local-documents/file-picker";

describe("local document identity", () => {
  it("generates a stable SHA-256 hash", async () => {
    const hash = await sha256File(new Blob(["same pdf bytes"]));
    expect(hash).toBe("7625d8eae3dc53619e17755bdec8f8dfab37382c888797442f7fcc5fe0e7ee38");
  });

  it("recognizes identical bytes after a rename", async () => {
    const original = new File(["%PDF-1.7 identical"], "original.pdf", { type: "application/pdf" });
    const renamed = new File(["%PDF-1.7 identical"], "renamed.pdf", { type: "application/pdf" });
    expect(await matchesFileHash(renamed, await sha256File(original))).toBe(true);
  });

  it("rejects a re-link hash mismatch", async () => {
    const expected = await sha256File(new Blob(["first"]));
    expect(await matchesFileHash(new Blob(["second"]), expected)).toBe(false);
  });

  it("rejects unsupported, empty, and oversized files", () => {
    expect(() => validateLocalPdf({ name: "notes.txt", size: 12, type: "text/plain" })).toThrow("PDF");
    expect(() => validateLocalPdf({ name: "empty.pdf", size: 0, type: "application/pdf" })).toThrow("empty");
    expect(() => validateLocalPdf({ name: "large.pdf", size: 101, type: "application/pdf" }, 100)).toThrow("local-processing limit");
  });

  it("reports no persistent-handle support outside a compatible browser", () => {
    vi.stubGlobal("window", {});
    expect(supportsPersistentFileHandles()).toBe(false);
    vi.unstubAllGlobals();
  });
});
