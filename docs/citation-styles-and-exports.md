# Citation styles and bibliography exports

## Styles

Marginalia exposes stable style IDs through `lib/citations/style-registry.ts`. Formatting happens on the server, and additional compiled CSL styles are loaded only when requested.

- APA 7th edition (`apa-7`)
- MLA 9th edition (`mla-9`)
- Chicago Notes & Bibliography (`chicago-notes`)
- Chicago Author-Date (`chicago-author-date`)
- Harvard — Cite Them Right (`harvard`)
- IEEE (`ieee`)
- Vancouver (`vancouver`)
- AMA 11th edition (`ama`)
- American Chemical Society (`acs`)
- Nature (`nature`)

The MLA, Chicago Notes & Bibliography, and ACS templates are bundled CSL files. Other expanded styles use small lazily loaded modules compiled from CSL. Adding a style requires one registry entry and either a bundled CSL template or a compiled-style loader; UI and API validation consume the same registry.

## Formats

- Plain text
- Markdown
- PDF
- DOCX
- BibTeX
- RIS
- CSL-JSON
- Clipboard with `text/plain` and `text/html` representations where the Clipboard API supports them

BibTeX, RIS, and CSL-JSON are created directly from normalized citation metadata. Display-oriented formats are produced from the standards-based formatting result. PDF and DOCX preserve hanging indents, emphasis, Unicode text, annotations, and automatic multipage flow.

## Limitations

- Citation.js produces bibliography entries for Chicago Notes & Bibliography; Marginalia does not currently generate numbered Word footnotes or endnotes.
- Rich clipboard HTML depends on browser permission and `ClipboardItem` support. Unsupported browsers receive the plain-text version.
- Citation quality still depends on the completeness of the saved structured metadata and the coverage of the selected CSL template.
