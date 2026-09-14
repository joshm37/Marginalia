import type { LocalPdfMetadata } from "./types";
import { provenanceValue } from "@/lib/metadata/provenance";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parsePdfDate(value: unknown) {
  const match = text(value).match(/^D:(\d{4})(\d{2})?(\d{2})?/);
  if (!match) return undefined;
  return [match[1], match[2], match[3]].filter(Boolean).join("-");
}

function splitAuthors(value: unknown) {
  return text(value)
    .split(/\s*;\s*|\s+and\s+|\n+/i)
    .map((author) => author.trim())
    .filter(Boolean);
}

function findIdentifiers(value: string) {
  const doi = value
    .match(/\b10\.\d{4,9}\/[\w.()/:+-]+/i)?.[0]
    ?.replace(/[.,;:)\]]+$/, "");
  const isbn = value
    .match(/\b(?:97[89][ -]?)?(?:\d[ -]?){9}[\dX]\b/i)?.[0]
    ?.replace(/[^0-9X]/gi, "");
  return { doi, isbn };
}

async function yieldToBrowser() {
  const scheduler = (globalThis as typeof globalThis & {
    scheduler?: { yield?: () => Promise<void> };
  }).scheduler;
  if (scheduler?.yield) await scheduler.yield();
  else await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

export async function extractLocalPdfMetadata(file: File): Promise<LocalPdfMetadata> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data: bytes });
  let document: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
  try {
    document = await loadingTask.promise;
  } catch {
    await loadingTask.destroy();
    throw new Error("This PDF appears to be corrupted, encrypted, or unreadable.");
  }
  try {
    const metadata = await document.getMetadata().catch(() => null);
    const info = (metadata?.info ?? {}) as Record<string, unknown>;
    const title = text(info.Title);
    const authors = splitAuthors(info.Author);
    const subject = text(info.Subject) || undefined;
    const keywords = text(info.Keywords)
      .split(/[,;]+/)
      .map((keyword) => keyword.trim())
      .filter(Boolean);
    const creationDate = parsePdfDate(info.CreationDate);
    let searchable = [title, ...authors, subject, ...keywords].filter(Boolean).join(" ");
    const pagesToScan = Math.min(document.numPages, 10);
    for (let pageNumber = 1; pageNumber <= pagesToScan; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      searchable += ` ${content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")}`;
      page.cleanup();
      await yieldToBrowser();
    }
    const identifiers = findIdentifiers(searchable.slice(0, 500_000));
    const provenance = {
      ...(title ? { title: provenanceValue(title, "PDF_METADATA", "MEDIUM") } : {}),
      ...(authors.length ? { authors: provenanceValue(authors, "PDF_METADATA", "MEDIUM") } : {}),
      ...(creationDate ? { publicationDate: provenanceValue(creationDate, "PDF_METADATA", "LOW") } : {}),
      ...(subject ? { description: provenanceValue(subject, "PDF_METADATA", "LOW") } : {}),
      ...(identifiers.doi ? { doi: provenanceValue(identifiers.doi, "PDF_METADATA", "MEDIUM") } : {}),
      ...(identifiers.isbn ? { isbn: provenanceValue([identifiers.isbn], "PDF_METADATA", "MEDIUM") } : {}),
    };
    return {
      title,
      authors,
      subject,
      keywords,
      creationDate,
      pageCount: document.numPages,
      ...identifiers,
      provenance,
    };
  } finally {
    await loadingTask.destroy();
  }
}
