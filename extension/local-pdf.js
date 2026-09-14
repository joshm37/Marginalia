export function classifyCapture(tab) {
  let url;
  try { url = new URL(tab.url); } catch { return { type: "UNSUPPORTED", reason: "No readable page URL." }; }
  if (url.protocol === "file:") {
    if (!/\.pdf$/i.test(url.pathname)) return { type: "UNSUPPORTED", reason: "Only PDF documents are supported for local capture." };
    return { type: "LOCAL_PDF", fileUrl: url.href };
  }
  if (["http:", "https:"].includes(url.protocol))
    return { type: /\.pdf$/i.test(url.pathname) ? "REMOTE_PDF" : "WEB_PAGE", url: url.href };
  return { type: "UNSUPPORTED", reason: "Open the PDF's original file tab. Chrome internal viewer pages cannot be captured directly." };
}

export async function captureLocalPdf(context, { allowed, fetchFile = fetch, loadUtilities }) {
  if (!await allowed()) throw new Error('Local PDF detected. Open chrome://extensions → Marginalia → Details → enable "Allow access to file URLs", then reload this PDF tab and reopen Marginalia.');
  const utilities = await loadUtilities();
  let response;
  try { response = await fetchFile(context.fileUrl, { signal: AbortSignal.timeout(15000) }); }
  catch { throw new Error("Chrome could not read this local PDF. Check file access permission and reopen the file tab."); }
  if (!response.ok) throw new Error("Chrome could not read this local PDF.");
  const name = decodeURIComponent(new URL(context.fileUrl).pathname.split("/").pop()).replace(/[\\/\u0000-\u001f\u007f]/g, "_");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > utilities.configuredMaxLocalPdfBytes()) throw new Error("This PDF exceeds the local processing size limit.");
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const file = new File(chunks, name, { type: "application/pdf" });
  utilities.validateLocalPdf(file);
  if (!new TextDecoder().decode(await file.slice(0, 1024).arrayBuffer()).includes("%PDF-")) throw new Error("This file is not a readable PDF.");
  const sha256 = await utilities.sha256File(file);
  const metadata = await utilities.extractLocalPdfMetadata(file);
  return {
    storageMode: "LOCAL",
    localFile: { sha256, filename: name, fileSize: file.size, mimeType: "application/pdf" },
    title: metadata.title || name.replace(/\.pdf$/i, ""), authors: metadata.authors,
    date: metadata.creationDate || "", doi: metadata.doi || "",
    type: metadata.isbn ? "Book" : "Article", isbn: metadata.isbn,
    description: metadata.subject, pageCount: metadata.pageCount,
    metadataProvenance: metadata.provenance,
  };
}
