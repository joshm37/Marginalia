# Cleanup and packaging pass — September 14, 2026

Removed the unreferenced `lib/demo-data.ts` fixture, temporary local-PDF URL tracing and headers, and unused direct `jspdf`/`@citestyle/core` dependencies. Citation.js, CSL styles, pdfmake exports, and PDF.js local reading remain in use. Historical database migrations and compatibility mappings were deliberately retained because older records and installations may still need them. Removed tracked code is recoverable from Git.

Corrected an outdated browser-test selector. Extension builds now watch shared PDF utilities, reject concurrent builds for the same destination, validate script dependencies and manifest assets before replacing output, exclude hidden/debug artifacts, and include the PDF.js license. CI now builds the development extension. Production origins must be credential-free HTTPS origins; development remains on localhost.

Production package: `.extension-build/marginalia-extension-0.6.1.zip`, configured for `https://marginalia-one-ochre.vercel.app`. Rebuild with:

```sh
EXTENSION_API_BASE=https://marginalia-one-ochre.vercel.app npm run extension:build:production
```

Verification: 155 unit/API/extension tests passed; lint/type-check passed; production Next.js build passed. ZIP integrity and contents checked. An isolated Chrome profile loaded the production service worker and popup without page errors, imported the shared PDF utilities, and confirmed the production API origin. Authenticated end-to-end workflows and database integration tests were not run locally in this pass. This is not a guarantee of zero regressions.

Before Chrome Web Store submission: provide current screenshots, publisher/contact details, and a live approved privacy policy (the application legal content is still marked as a draft placeholder). Verify production sign-in, capture, local file permission, retries, and citation output using a beta account. If version 0.6.1 has already been uploaded, bump the manifest version before rebuilding. No store upload or deployment was performed.
