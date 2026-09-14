# Marginalia beta operations

This checklist describes operational work that cannot be completed by application code alone.

## Production configuration

- Set `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` separately for Production and Preview in Vercel.
- Set `SUPABASE_SERVICE_ROLE_KEY` as a server-only Vercel secret. Never use a `NEXT_PUBLIC_` prefix or package it with the Chrome extension.
- Set `NEXT_PUBLIC_SUPPORT_EMAIL` to a monitored support address.
- Apply and verify the RLS policies in `docs/supabase-rls.sql` without removing application-level ownership checks.
- Configure Supabase production URL, allowed callback URLs, SMTP, confirmation email, and password-reset email templates.

## Backups and restore testing

- Choose a Supabase plan and retention window that meets the beta's recovery requirements; free-plan backup availability can change and must be verified in the Supabase dashboard.
- Before each schema deployment, create a recoverable database backup or logical `pg_dump` from an appropriately secured environment.
- Store exports encrypted, restrict access, define retention, and record the database schema/migration revision alongside each backup.
- At least monthly during beta, restore the latest backup into an isolated non-production database.
- Run `prisma migrate status`, the integration suite, record-count checks, ownership-isolation checks, and representative citation/excerpt reads against the restored database.
- Record restore time, backup timestamp, responsible operator, failures, and remediation. A backup is not considered verified until a restore succeeds.
- Never restore production research content into an unsecured local or preview environment.

## Account deletion recovery

Application rows are removed first through the `User` cascade, then the Supabase Auth account is removed using the server-only Admin API. If Auth removal fails, the endpoint reports failure and the user may sign in and retry; the application user will be recreated empty and no deleted research data is restored. Investigate the `auth_account_deletion_failed` event without logging the user ID, email, or research content.

## Data exports

The account archive is versioned JSON and includes projects, sources, structured citation metadata, contributors, tags, excerpts, notes, timestamps, and join relationships. Stored files are represented by their source/file references; the current application does not bundle remote file bytes. Verify whether those references require signed-URL handling before introducing private file storage.

## Error monitoring

`instrumentation.ts` forwards sanitized server failures through `lib/observability/error-reporter.ts`. Select a monitoring vendor before beta, initialize its SDK in `instrumentation.ts`, and replace/configure the reporter there. Do not attach request bodies, headers, cookies, URLs submitted for analysis, citation payloads, excerpts, notes, or user identifiers.

Configure alerts for:

- elevated API 5xx rates;
- authentication callback/refresh failures;
- account deletion Auth-cleanup failures;
- database connection exhaustion and migration failures;
- metadata provider timeout/rate-limit spikes;
- extension API failures.

## Release and incident checklist

- Run lint, type checking, unit/API tests, database integration tests, browser tests, and a production build.
- Verify data export and account deletion against a disposable production-like account.
- Verify privacy/terms routes contain owner-approved copy rather than draft placeholders.
- Confirm the support inbox is monitored and the displayed release version is current.
- Keep an incident log and documented contact for Supabase, Vercel, and extension-store escalation.
