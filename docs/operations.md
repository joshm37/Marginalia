# Marginalia operations runbook

## Required configuration

The application validates these variables before authenticated server work begins:

- `NEXT_PUBLIC_SUPABASE_URL` — public configuration
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — public configuration
- `DATABASE_URL` — secret PostgreSQL connection string

Set all three in local `.env.local` and in every Vercel environment that should run the app. Redeploy after changing a `NEXT_PUBLIC_*` value because Next.js embeds it at build time.

## Database migrations

Use versioned migrations for every schema change:

```bash
npm run db:migrate -- --name describe_the_change
npm run db:deploy
```

Do not use `db:push` against production.

### Baseline the existing Supabase database once

The database predates the migration history. Back it up first, confirm it already matches `prisma/schema.prisma`, then run:

```bash
npx prisma migrate resolve --applied 20260902000000_initial_schema
npm run db:deploy
npm run db:status
```

The first command records the existing schema without recreating or deleting its tables. The deploy command then creates the new durable rate-limit table. Do not mark the second migration as applied manually.

For a brand-new empty database, only run `npm run db:deploy`.

## Backup and recovery

Create a logical backup before migrations and at regular intervals:

```bash
pg_dump --format=custom --no-owner --no-acl --file=marginalia.backup "$DATABASE_URL"
```

Keep backups outside the repository and verify them periodically by restoring into a temporary PostgreSQL database:

```bash
pg_restore --clean --if-exists --no-owner --no-acl --dbname="$RESTORE_DATABASE_URL" marginalia.backup
```

Never test a restore against production. Supabase-managed backups or point-in-time recovery can supplement logical backups when available on the selected plan.

## Deployment checklist

1. Create and verify a database backup.
2. Run `npm run lint`, `npm run typecheck`, and `npm run build`.
3. Run `npm run db:status` against the target database.
4. Apply pending migrations with `npm run db:deploy`.
5. Deploy the application.
6. Request `GET /api/health` and confirm `{ "status": "ok" }`.
7. Sign in and test one read and one reversible write.
8. Review Vercel logs for structured `api_request_failed` events.

## Incident response

- Record the `requestId` returned by a failed API response.
- Search Vercel logs for that request ID.
- If the database is unavailable, stop writes and verify Supabase status and connection limits.
- If a migration fails, do not rerun destructive SQL manually. Inspect `prisma migrate status`, restore a backup if required, and use `prisma migrate resolve` only after determining the database's actual state.
- Roll back application code independently from the database. Database rollbacks require an explicit corrective migration or a tested restore.

## Rate limits

- Extension sign-in: 20 attempts per IP and 10 per account every 15 minutes
- Extension token refresh: 30 attempts per token/IP pair every 15 minutes
- Webpage metadata analysis: 30 requests per authenticated user per minute

Identifiers are SHA-256 hashed before they are stored. Expired buckets are cleaned up opportunistically.
