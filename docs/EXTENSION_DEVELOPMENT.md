# Extension development

## PDFs opened from disk

After rebuilding, enable **Allow access to file URLs** under Marginalia's Details in `chrome://extensions`. Reload the extension and the local PDF tab. The popup classifies the top-level tab URL before HTML extraction, reads local bytes only with file access enabled, verifies the PDF signature, and runs the same hashing, validation, and metadata extraction code as the website. The build transpiles those TypeScript utilities and packages PDF.js and its worker locally; no remote scripts are loaded.

The review shows a safe filename and page count instead of a filesystem URL. Saving sends `storageMode: LOCAL` and `localFile: {sha256, filename, fileSize, mimeType}`; it omits identity URL fields and does not fabricate lastModified. DOI enrichment still uses the existing server endpoint. HTTPS PDFs remain WEB records. Duplicate PDFs are recognized by hash and offer links to the existing source and project. Local bytes and the temporary file URL are not queued or uploaded.

Chrome's internal viewer does not expose ordinary webpage selection to the extension. Use the source's Marginalia PDF reader for page-aware excerpts; locate the file there when requested. Capturing a source in the extension does not grant the website a persistent file handle. Unsupported internal viewer URLs are reported explicitly; open the original file tab.

Authoritative source: `extension/`. These are browser-native JavaScript modules, a classic content script, HTML/CSS, and icons; no bundler is needed. The build copies every source file, replaces `config.js`, adjusts host permissions, and stamps the three entry scripts and manifest with the same build identity.

## Daily workflow

1. Edit `extension/`.
2. Run `npm run extension:build`, or keep `npm run extension:dev` running to rebuild on changes. Changes to the build script itself require restarting the watcher.
3. Open `chrome://extensions` and enable Developer mode.
4. Inspect Marginalia's Details and its unpacked source path. Load unpacked from **`.extension-build/marginalia`** in this repository. Do not load `extension/`, a Downloads copy, or `.extension-build/production` for local work. Disable obsolete copies so their identical icons do not cause confusion. Changing unpacked directories can change the extension ID and require signing in again; ordinary reloads keep storage.
5. After the build completes, click Reload on that extension card and reopen its popup.
6. Reload the article webpage and dashboard tabs. Existing injected content scripts are not hot-replaced by rebuilding files or reloading the extension.
7. Verify the popup footer's build timestamp, commit, and API origin against the build terminal or `build-info.json`.
8. Click the service worker Inspect link on the extension card. Look for `[MARGINALIA SERVICE WORKER] build …`. Popup DevTools logs `[MARGINALIA POPUP]`; the reloaded webpage's console logs `[MARGINALIA CONTENT SCRIPT]`. All three must match. These development logs contain only build identity and API origin.

The manifest continues to reference `background.js` (module service worker), `popup.html` → `popup.js`, and `content.js` at document idle. The popup also injects a metadata extraction function through `chrome.scripting.executeScript`; that function comes from the current popup code. It does not refresh the static content script in existing tabs.

## Commands and environments

```sh
npm run extension:build
npm run extension:dev
# If generated output is suspect (stop the watcher first):
npm run extension:clean
npm run extension:build
# Release packaging, separate output:
EXTENSION_API_BASE=https://your-domain.example npm run extension:build:production
```

`extension:build:dev` remains an alias for the development build. Development always uses `http://localhost:3000`; production requires an explicit HTTPS origin and writes `.extension-build/production` plus a versioned ZIP in `.extension-build/`. Production builds do not overwrite the development directory. Generated output is ignored by Git. Clean removes only `.extension-build`, never source or Chrome profile/session storage.

## Version versus freshness

`extension/manifest.json` currently specifies release version **0.6.1**. It changes manually for a store release, not for source edits. Each build adds `version_name` and a visible footer with commit SHA plus UTC build timestamp. The timestamp distinguishes uncommitted edits on the same SHA. `build-info.json` also records SHA-256 hashes of the input popup, worker, and content script. Production retains build identity but omits startup console logging.

The previous README recommended the source directory while the release guide recommended the copied output. Both were plausible unpacked roots, and rebuilding the copy would never update another directory Chrome had loaded. Chrome's actual loaded path must be checked in the browser; repository inspection alone cannot establish it.
