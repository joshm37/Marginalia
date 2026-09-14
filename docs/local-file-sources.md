# Local-file source foundation

## Storage model

`Source.storageMode` describes the source's primary storage/origin state:

- `WEB`: an HTTP/HTTPS source. Existing records are migrated to this value.
- `LOCAL`: file bytes remain on the user's device and `LocalFileReference` stores identity metadata only.
- `ARCHIVED`: reserved for a future managed/cloud copy. API creation is intentionally disabled until archival storage exists.

`LocalFileReference` is one-to-one with `Source`. It stores a lowercase SHA-256 hash, basename-only original filename, byte size, MIME type, and optional browser-provided last-modified timestamp. It never stores file bytes, absolute paths, `file://` URLs, directory names, or OS usernames.

The `(userId, sha256)` constraint is unique. Hashes are deliberately not globally unique: separate users may independently register the same published PDF without exposing or coupling their libraries. The composite `(sourceId, userId)` foreign key prevents a local identity record from being attached across ownership boundaries.

Storage mode and local identity are compatible rather than mutually destructive. A future transition from `LOCAL` to `ARCHIVED` can retain the original hash while a separate storage adapter records the managed cloud copy.

## API contract

Existing web clients require no changes because omitted `storageMode` means `WEB` and web sources still require an HTTP/HTTPS `url`.

A future local-file client sends the normal source citation fields plus:

```json
{
  "storageMode": "LOCAL",
  "localFile": {
    "sha256": "64 lowercase or uppercase hexadecimal characters",
    "filename": "article.pdf",
    "fileSize": 123456,
    "mimeType": "application/pdf",
    "lastModified": "2026-09-13T12:00:00.000Z"
  }
}
```

No `url` is required for `LOCAL`. If a legitimate HTTP landing-page URL exists, it may still be supplied for citation purposes. `GET /api/sources/check-duplicate?fileHash=...` supports re-link checks without a URL.

## Duplicate precedence

Resolution is deterministic within the authenticated user's library:

1. normalized DOI;
2. normalized canonical URL;
3. normalized URL;
4. lowercase local SHA-256 hash.

Title similarity is never authoritative. The database constraint also protects against same-user hash races.

## Client requirements for the later PDF implementation

- Read bytes only after a direct user file-selection gesture.
- Compute SHA-256 over the exact raw file bytes with Web Crypto before creation/re-linking.
- Do not send bytes, `File` objects, paths, `file://` URLs, directory handles, or object URLs to the API.
- Send `File.name` as a basename only, `File.size`, `File.type` (or a safely detected MIME type), and an ISO timestamp derived from `File.lastModified` when available.
- Recompute the full hash whenever the user re-links. Filename, size, and last-modified time are hints, not identity.
- Keep any browser file handle in client-controlled storage only; it is not synchronized through Marginalia's database.
- A local excerpt may omit `pageUrl` and should put stable PDF page/location selectors in `locationData`.
- Treat `ARCHIVED` as unavailable until a server-managed storage adapter and authorization policy are implemented.
