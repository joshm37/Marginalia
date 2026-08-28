# Marginalia

A browser-first research library prototype built with Next.js, TypeScript, and React.

## What works
- Dashboard with source/project/annotation stats
- Source library with search
- Add source flow
- Source detail view
- APA / MLA / Chicago citation generation
- Copy citation to clipboard
- Open original source
- Projects
- Tags
- Annotation library
- Local persistence using `localStorage`
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

Copy `.env.example` to `.env`, update `DATABASE_URL` for your PostgreSQL instance, then run:

```bash
npm run db:generate
npm run db:push
```

`db:push` is the simplest bootstrap command for a hosted Supabase development database. Use versioned Prisma migrations before production deployment.

## Authentication setup

Create a Supabase project and add its Project URL and publishable key to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_your-key"
```

In Supabase Auth URL Configuration, set the local Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` as a redirect URL. Email/password sign-in and confirmation are supported. Authenticated browser-extension requests can send the same Supabase access token as `Authorization: Bearer <token>`.

The dashboard and application pages are protected by middleware. API routes independently verify the current user and scope every repository operation by the verified Supabase user ID.

The Prisma schema models users, sources, projects, tags, annotations, and explicit join records. UI code should access persistence through the repository and service modules in `lib/repositories` and `lib/services`; it should never import the Prisma client directly.

## Architecture notes

The visual prototype still falls back to localStorage so it can be demonstrated without infrastructure. The PostgreSQL/Prisma persistence layer is now available for the upcoming authenticated server-data integration:

- Next.js App Router
- TypeScript
- Source / Project / Annotation entities
- Repository/service boundary around Prisma
- User-scoped database records and duplicate-detection indexes
- Replaceable search layer
- Independent citation formatting layer
- Browser-extension-ready source capture workflow

The next production step is adding authentication and connecting the dashboard and extension API routes to these services.
