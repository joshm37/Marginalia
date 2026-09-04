# Marginalia

A browser-first research library built with Next.js, TypeScript, React, PostgreSQL, Prisma, Supabase Auth, and a Chrome extension.

## What works

- Dashboard with source/project/excerpt stats
- Source library with search
- Add source flow
- Source detail view
- APA / MLA / Chicago citation generation
- Copy citation to clipboard
- Open original source
- Projects
- Tags
- Excerpt library
- Authenticated PostgreSQL persistence
- URL metadata analysis and duplicate detection
- Chrome extension source and excerpt capture
- Dark mode and guided app walkthrough
- Responsive UI

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

For a production build:

```bash
npm run build
npm start
```

## Database setup

Copy `.env.example` to `.env.local`, update the values for your Supabase project, then run:

```bash
npm run db:generate
npm run db:deploy
```

Use `npm run db:migrate -- --name change_name` while developing schema changes and `npm run db:deploy` in deployed environments. Do not use `db:push` against production. Existing databases created before migration tracking require the one-time baseline procedure in [the operations runbook](docs/operations.md).

## Authentication setup

Create a Supabase project and add its Project URL and publishable key to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_your-key"
```

In Supabase Auth URL Configuration, set the local Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` as a redirect URL. Email/password sign-in and confirmation are supported. Authenticated browser-extension requests can send the same Supabase access token as `Authorization: Bearer <token>`.

The dashboard and application pages are protected by middleware. API routes independently verify the current user and scope every repository operation by the verified Supabase user ID.

The Prisma schema models users, sources, projects, tags, excerpts, and explicit join records. UI code should access persistence through the repository and service modules in `lib/repositories` and `lib/services`; it should never import the Prisma client directly.

If your database was created before the excerpt terminology change, run `npm run db:rename-excerpts` once. It renames the existing tables, enum, columns, indexes, and constraints without deleting excerpt data. Then run `npm run db:generate`.

## Architecture notes

Research data is loaded from authenticated API routes and persisted in PostgreSQL. Browser storage is limited to device preferences; extension storage holds its Supabase session and short-lived caches.

- Next.js App Router
- TypeScript
- Source / Project / Excerpt entities
- Repository/service boundary around Prisma
- User-scoped database records and duplicate-detection indexes
- Browser-extension-ready source capture workflow
- Runtime request validation and structured API errors
- Durable rate limits for sensitive endpoints
- Versioned database migrations

## Citation pipeline

Marginalia keeps citation work in explicit, replaceable stages:

```text
webpage/extension extraction
  -> DOI detection
  -> optional cached Crossref enrichment
  -> user review and correction
  -> normalized citation metadata in PostgreSQL
  -> CSL-JSON mapping
  -> Citation.js + official CSL style
```

The original URL normalization, duplicate detection, validation, and manual review behavior remains in place. Structured authors, editors, translators, journal/container title, volume, issue, pages, edition, publisher information, issued/accessed dates, DOI, ISBN, ISSN, language, and abstract are stored in the source's `citationMetadata` JSON field. Formatted strings are generated on demand and are not persisted.

APA uses Citation.js's bundled APA 7 style. MLA uses the official MLA 9 CSL style, and Chicago uses the official Chicago 18 notes-and-bibliography CSL style. Formatting is isolated behind `CitationEngine`, so the processor can be replaced without changing persistence or UI code.

Set `CROSSREF_MAILTO` in production to identify Marginalia to Crossref's polite API pool. Crossref is contacted only when a DOI is detected; successful results are cached for 24 hours, failures briefly, and enrichment failures never block manual capture.

## Production operations

See [docs/operations.md](docs/operations.md) for environment configuration, existing-database baselining, migrations, backups, deployment checks, health monitoring, and incident response.

## Automated testing

Run the fast unit, API, citation, normalization, and extension tests with:

```bash
npm test
```

Repository integration tests require a disposable PostgreSQL database. They intentionally refuse Supabase URLs so production data cannot be touched:

```bash
createdb marginalia_test
TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/marginalia_test" \
  DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/marginalia_test" \
  npm run db:deploy
TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/marginalia_test" \
  npm run test:integration
```

Install Chromium once, then run the browser journeys against that same disposable database:

```bash
npx playwright install chromium
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/marginalia_test" npm run test:e2e
```

The browser suite uses a development-only authentication fixture. Both the server and build configuration reject that fixture in production. GitHub Actions provisions PostgreSQL and runs linting, type-checking, all tests, and the production build on every push and pull request.

## Test the Chrome extension

1. Start Marginalia with `npm run dev`.
2. Open `chrome://extensions`, enable Developer mode, and choose **Load unpacked**.
3. Select the repository's `extension` directory.
4. Open an article, click the Marginalia extension, and sign in with your existing account.
5. Review the extracted metadata, choose a project, and save.
6. Close the extension popup and highlight text on the saved page.
7. Add an excerpt type, tags, and a note in the in-page Marginalia prompt.
8. Return to the dashboard; it refreshes on focus and displays the source and excerpt.

The source extension targets `http://localhost:3000` for local development. Create a production Chrome Web Store package with `EXTENSION_API_BASE=https://your-domain.example npm run extension:build`; the build safely replaces the API origin and host permission without editing source files. See [the extension release checklist](docs/chrome-web-store.md).
