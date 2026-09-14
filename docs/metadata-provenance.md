# Metadata provenance and review rules

Marginalia stores field provenance under `Source.citationMetadata.provenance`.
Frequently queried citation values remain authoritative in relational columns;
provenance describes those values and does not replace them.

Each resolved field records its value, provider, categorical confidence, and
whether a user manually confirmed it. Confidence is deliberately categorical:

- `HIGH`: authoritative DOI metadata, dedicated `citation_*` tags, or PRISM
  bibliographic tags.
- `MEDIUM`: structured JSON-LD or Dublin Core metadata.
- `LOW`: Open Graph, generic HTML, or a value inferred from the submitted URL.

Resolution is deterministic:

1. A manually edited/reviewed value always wins and becomes `USER / HIGH`.
2. When a DOI resolves, non-empty Crossref bibliographic fields replace
   conflicting webpage fields and become `CROSSREF / HIGH`.
3. The canonical webpage URL and access date remain tied to the page capture;
   Crossref does not replace them.
4. Without Crossref, extraction uses field-specific semantic sources. Dedicated
   citation or PRISM tags are preferred for journal fields; JSON-LD is preferred
   for typed people and publisher data; Dublin Core follows; Open Graph and
   generic HTML are fallbacks.
5. URL inference never turns an analysis into a successful extraction.

`metadataNeedsReview` is derived rather than manually toggled. A source enters
the review queue when it lacks a title, lacks both creators and a publisher,
lacks a publication date/container/DOI anchor, or has an unreviewed low-confidence
important field. Users do not need to approve every field: editing a field marks
that field as manually confirmed, and ordinary high-quality results can be saved
without extra clicks.

Provider names reserve `PUBMED`, `OPENALEX`, and `ISBN_PROVIDER` for future
enrichment without requiring another storage migration.
