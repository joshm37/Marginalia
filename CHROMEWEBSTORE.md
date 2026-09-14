# Chrome Web Store Listing — Marginalia

Contributor review now uses individual author, editor, and translator inputs with add/remove controls. Refresh source-review screenshots before the next store submission; release version remains unchanged.

> Last Updated: 2026-09-14

Local PDF capture: `file:///*` host access lets Marginalia read a PDF selected by the active tab only after the user enables Chrome's “Allow access to file URLs” setting. Bytes are processed locally for hashing and citation metadata. Only the safe filename, hash, size, citation metadata, and selected research records are sent to Marginalia; filesystem URLs are not sent. Refresh permission disclosures and popup screenshots before release. Release version remains 0.6.1 pending submission.

## Store Listing

**Extension Name:** Marginalia

**Short Description:** Save webpage sources and selected excerpts directly to your Marginalia research projects.

**Detailed Description:**

Marginalia captures sources and selected passages while you research on the web.

Review detected citation details, organize a source into a project, add reusable tags, and save it to your research library. Select an important passage to attach it to the saved source with context, a note, and a page number when available. Temporary connection failures are retried automatically.

Open Marginalia on a research page, review the source details, choose a project, and save. To capture a passage later, select it and use the Marginalia prompt, context menu, or Alt+Shift+M.

Marginalia accesses page metadata and text only to perform capture features requested by the user. Research data is transmitted only to the user's configured Marginalia account.

**Category:** Productivity

**Single Purpose:** Capture research sources and selected excerpts into a user's Marginalia library.

**Primary Language:** English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|---|---:|---|---|
| Store icon | 128×128 | Ready | `extension/icons/icon-128.png` |
| Screenshot 1 | 1280×800 or 640×400 | Needs update | Source capture popup on an article |
| Screenshot 2 | 1280×800 or 640×400 | Needs update | Selected-excerpt capture |
| Screenshot 3 | 1280×800 or 640×400 | Needs update | Saved source in the dashboard |
| Small promo tile | 440×280 | Not created | |

## Permissions Justification

| Permission | Type | Justification |
|---|---|---|
| `activeTab` | permissions | Reads metadata from the current page after the user opens Marginalia. |
| `scripting` | permissions | Extracts citation metadata from the active page for user review. |
| `storage` | permissions | Preserves the signed-in session, theme, source mappings, and temporary retry queue across popup closure and browser restarts. |
| `tabs` | permissions | Reads the active tab title and URL and opens a saved Marginalia source or project when requested. |
| `contextMenus` | permissions | Adds “Save selection to Marginalia” to the selection context menu. |
| `alarms` | permissions | Retries captures that failed because the network was temporarily unavailable. |
| Production Marginalia origin | host_permissions | Sends authenticated capture requests only to the deployed Marginalia service. The production build scopes this to one configured HTTPS origin. |
| `<all_urls>` | content-script matches | Detects user text selections on research pages. It does not grant backend network access and does not transmit content until the user saves it. |

## Privacy & Data Use

**Does the extension collect user data?** Yes.

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|---|---|---|---|---|
| Personally identifiable info | Email | Yes | Authenticate the user's Marginalia account | Supabase as authentication processor |
| Authentication info | Access and refresh tokens | Yes | Maintain the signed-in session | Supabase as authentication processor |
| Web history | Current page URL when captured | Yes | Link a saved source or excerpt to its origin | No sale or advertising sharing |
| Website content | Citation metadata and user-selected text | Yes | Save requested research records | No sale or advertising sharing |
| User activity | Tags, projects, and notes entered in the extension | Yes | Organize the user's research | No sale or advertising sharing |

- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

Authentication data and temporarily queued captures are retained in extension-local storage. Research records are retained in the user's Marginalia account until deleted by the user. Signing out removes the locally stored extension session.

## Privacy Policy

**Privacy Policy URL:** Required before submission; publish the Marginalia privacy policy at a stable HTTPS URL.

## Distribution

**Visibility:** Unlisted beta initially

**Regions:** All regions

## Developer Info

**Publisher Name:** Required before submission

**Contact Email:** Required before submission

**Support URL:** `https://github.com/joshm37/Marginalia/issues`

## Version History

| Version | Date | Changes | Status |
|---|---|---|---|
| 0.6.1 | 2026-09-09 | Prevents duplicate queue entries and retries pending captures as soon as the popup reconnects. | Draft |
| 0.6.0 | 2026-09-08 | Production configuration, persistent authentication, retry queue, duplicate handling, PDF/keyboard capture, and security hardening. | Draft |

## Review Notes

### Known limitations

- Text selection is unavailable on browser-internal and other Chrome-restricted pages.
- Some publishers block metadata extraction, in which case users review and correct fields manually.
- Store screenshots, publisher contact details, and a live privacy-policy URL remain required.
