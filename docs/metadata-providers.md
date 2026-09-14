# Metadata enrichment providers

Enrichment runs during source analysis or editing, never during citation formatting. Provider failures are optional and do not block the review form.

## Selection

- DOI: Crossref first. OpenAlex runs only if Crossref has no sufficiently complete record.
- PMID or PMCID: PubMed first. OpenAlex runs only if PubMed has no sufficiently complete record.
- ISBN: Open Library Books API only.
- Explicit OpenAlex work ID: OpenAlex only (in addition to any identifier-specific primary provider).
- No supported identifier: no provider request. Marginalia keeps the webpage extraction result.

There is no title-search fallback: it is too easy to attach metadata for the wrong work.

## Field precedence

Manually reviewed user values always win. The remaining authority order is Crossref, PubMed, Open Library, OpenAlex, then webpage metadata and URL inference. Providers fill missing or lower-authority fields rather than blindly replacing the complete record.

All providers use a four-second timeout, cache successes for 24 hours and failures for five minutes, recognize 404 and 429 responses, and return structured status information. `CROSSREF_MAILTO`, `NCBI_API_KEY`, and `OPENALEX_API_KEY` are optional server-only configuration. Never expose them to the dashboard or extension.
