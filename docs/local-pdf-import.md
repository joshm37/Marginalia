# Local PDF import and re-linking

## Privacy boundary

PDF bytes are read only by the browser after the user chooses a file. Hashing and PDF metadata extraction run locally. No API accepts the PDF body, a `File`, an object URL, a `file://` URL, an absolute path, or a directory handle.

The server receives only the SHA-256 hash, basename, byte size, MIME type, optional last-modified timestamp, user-reviewed citation fields, project/tag relationships, and identifiers used for optional enrichment. PostgreSQL stores that same safe identity and citation metadata through `Source` and `LocalFileReference`.

## Device-local association

Marginalia stores a record keyed by source ID in the `marginalia-local-documents` IndexedDB database. It contains the safe file identity, link timestamp, and—where the browser permits structured cloning—a `FileSystemFileHandle`. This database is device/browser-profile local and is never synchronized to Supabase.

Chromium browsers with the File System Access API can retain handles, subject to browser permission rules. Firefox and Safari use the ordinary file-input fallback: importing works, but the user may have to locate the file again after reopening the app. A missing or revoked local handle never damages the server-side source.

## Processing pipeline

1. Validate the selected PDF locally.
2. Compute SHA-256 with Web Crypto.
3. Check the authenticated library for the same per-user hash.
4. Lazily load PDF.js and extract embedded metadata plus text from at most the first ten pages.
5. Send a detected DOI or ISBN to the existing server enrichment providers when available.
6. Present the normal editable citation review form.
7. Save metadata and local-file identity, then remember the device association in IndexedDB.

Re-linking always recomputes the full SHA-256 value. A renamed or moved identical file succeeds; a different file shows a mismatch and does not alter server or local identity. The local processing ceiling defaults to 512 MB and can be configured with `NEXT_PUBLIC_MAX_LOCAL_PDF_MB` to protect browser memory.

## Local reader

`/sources/:id/read` is an authenticated route for `LOCAL` sources. The server supplies source metadata and owned excerpts, but the client retrieves the PDF only through its device-local IndexedDB association. PDF.js is dynamically imported after a linked file is available. Pages one and two render immediately; later pages are activated with `IntersectionObserver` shortly before they enter the viewport. Canvas render tasks are cancelled and PDF page resources are cleaned up on unmount.

The selectable PDF text layer creates versioned `PDF_TEXT_QUOTE` anchors:

```json
{
  "version": 1,
  "kind": "PDF_TEXT_QUOTE",
  "pageNumber": "7",
  "exact": "selected text",
  "prefix": "text immediately before",
  "suffix": "text immediately after",
  "textStart": 120,
  "textEnd": 133,
  "rect": { "x": 40, "y": 180, "width": 220, "height": 34 }
}
```

Exact text, prefix, suffix, and page number are authoritative for re-anchoring. Offsets and geometry are optional hints. If text cannot be re-anchored after a PDF changes or has a weak text layer, the reader still jumps to the stored page and selects the excerpt in the side panel.

Encrypted PDFs prompt for a password locally. The password is neither persisted nor transmitted. Scanned/image-only PDFs remain readable as rendered pages, but excerpt selection is unavailable because this version does not perform OCR.
