# Beta security model

## Authorization boundary

Every API handler authenticates with `requireUser`. Repository methods accept the verified Supabase user ID and constrain reads, writes, deletes, project associations, source associations, and tag creation by that ID. A missing or foreign record is returned as not found rather than revealing ownership.

Supabase RLS is defense in depth for access through the Supabase Data API; it does not replace repository authorization. Apply `docs/supabase-rls.sql` in Supabase. Enable RLS on `User`, `Source`, `Project`, `Tag`, `Excerpt`, `Contributor`, `LocalFileReference`, all five content join tables, and `RateLimitBucket`. The rate-limit table has no client policy.

Prisma commonly connects through a privileged direct database role that may bypass RLS. Keep `DATABASE_URL` server-only and never place it, the Supabase service-role key, access tokens, or refresh tokens in `NEXT_PUBLIC_*`, browser code, or the extension package. Do not grant permissive RLS policies merely to accommodate Prisma.

## Supabase production configuration

Configure the production site URL and allow-list these redirect URLs in Supabase Auth:

- `https://YOUR_DOMAIN/auth/callback`
- Vercel preview callback URLs only if preview authentication is intentionally supported
- `http://localhost:3000/auth/callback` for local development only

Enable email confirmation for beta users. Configure secure SMTP delivery and password-reset templates. The callback accepts only relative in-app destinations and rejects protocol-relative redirects.

## Serverless rate limiting

Rate limits use the PostgreSQL `RateLimitBucket` table with an atomic upsert. They are shared across Vercel instances and fail closed if PostgreSQL is unavailable. They do not rely on process memory. Login is limited by both client IP and a hash of the normalized email; refresh is limited by client IP plus a hash of the refresh token; analysis and DOI enrichment are limited per authenticated user.

`x-forwarded-for` is trusted because Vercel overwrites it at the platform boundary. If the app is deployed behind another proxy, that proxy must strip client-supplied forwarding headers.

## External URL retrieval

User-submitted URLs are restricted to HTTP/HTTPS without credentials. DNS answers and every redirect target are checked against local, private, link-local, reserved, benchmarking, documentation, multicast, and unspecified address ranges. Retrieval uses manual redirects, a five-redirect limit, a ten-second timeout, a one-megabyte body limit, and HTML/XHTML content-type checks.

DNS rebinding between validation and the runtime's connection remains a residual risk because the platform fetch implementation performs its own DNS resolution. Production should additionally enforce outbound network controls if the hosting platform makes them available.

Crossref requests use a fixed HTTPS origin and an encoded DOI path; users cannot choose that upstream host.

## Operational requirements

- Keep production and preview secrets separate in Vercel.
- Rotate any secret accidentally committed or pasted into logs.
- Review Supabase Auth and Vercel logs without logging tokens or request bodies.
- Back up and restore-test PostgreSQL before schema or RLS changes.
- Re-run authorization, SSRF, dependency, integration, and browser tests before each beta release.
- Follow the backup, restore-test, deletion-recovery, and monitoring checklist in `OPERATIONS.md`.

## Logging and monitoring data boundary

Structured application logs accept only a small allowlist of operational fields. Source URLs, titles, article text, excerpts, notes, citation payloads, authorization headers, cookies, tokens, email addresses, and secrets must not be logged. Source-analysis events record response status/type/size and extraction status, not the submitted or final URL or extracted values.

`instrumentation.ts` provides a vendor-neutral server error hook. Any future monitoring adapter must keep this boundary and must not enable automatic request-body or header capture.
