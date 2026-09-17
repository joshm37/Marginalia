# Chrome Web Store release

## Build

```sh
npm run extension:build:dev
EXTENSION_API_BASE=https://your-marginalia-domain.example npm run extension:build:production
```

The uploadable ZIP is written to `.extension-build/`. Production builds require a credential-free HTTPS origin and configure backend access to that origin while retaining file access for local PDFs. The build validates script imports and manifest references and includes the PDF.js license.

## Submission checklist

1. Test the unpacked `.extension-build/production` directory in `chrome://extensions`. Development uses `.extension-build/marginalia`; see [development workflow](EXTENSION_DEVELOPMENT.md).
2. Verify sign-in, source capture, duplicate detection, excerpt capture, queued retry, and dashboard links against production.
3. Upload the generated ZIP to the Chrome Web Store developer dashboard.
4. Supply store screenshots, a 1280×800 promotional image, support URL, and privacy-policy URL.
5. Explain in the privacy disclosure that Marginalia reads metadata and user-selected text only to save requested research content. Authentication tokens and queued captures are stored in extension-local storage and sent only to the configured Marginalia service.
6. Justify permissions: `activeTab`/`scripting` extract requested page metadata; `tabs` reads the active page URL/title and opens saved records; `storage` retains the session and retry queue; `contextMenus` and `commands` support selection capture; `alarms` retries temporary failures. Keep `CHROMEWEBSTORE.md` synchronized with the dashboard disclosure form.
7. Confirm the configured production origin and `file:///*` permissions match the disclosure. Never submit a development build.

Increment `version` in `extension/manifest.json` for every submitted update.
