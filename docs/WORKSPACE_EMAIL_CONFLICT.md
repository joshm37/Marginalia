# Production workspace email conflict

## Confirmed failure

GET / (RSC request) returned HTTP 200 with a server-rendering error, digest
3931869869. The actual exception was Prisma P2002 on User_email_key in
requireUser's ID-based User upsert. Supabase getUser had already returned a
user with an email; application user synchronization failed before workspace
queries ran. This is not evidence of a bad password or a connection outage.

The email conflicted with another application user ID. The log alone cannot
establish whether the current ID already had a row, why the other row exists,
or whether that row belongs to the same person. Do not merge by email.

## Fix and rollout

User.id remains the identity and ownership boundary. User.email is a mutable
contact snapshot, no longer unique. Supabase continues to manage authentication.
Migration 20260917000000_user_email_contact_snapshot drops only the email unique
index; all users, research, foreign keys, RLS, and userId filters remain intact.

1. Review pending migrations and confirm the intended production DATABASE_URL
   without exposing it. Follow the normal backup procedure.
2. Run `npm run db:status`, then `npm run db:deploy` against that database.
   Deploy applies all pending migrations, not just this one; review them first.
3. Deploy this revision to Vercel (build regenerates Prisma).
4. Sign in from a fresh browser on the production domain. Verify GET / renders
   normally and authenticated GET /api/workspace returns 200.
5. Verify a new workspace is empty and another user's records are inaccessible.

An account with a new Supabase ID will not inherit research from an older ID.
If recovery is needed, independently verify ownership before planning any data
transfer. Never delete the conflicting user as a quick fix.

Removing uniqueness is compatible with the old ID-based upsert, so the migration
can precede deployment. Reintroducing uniqueness later requires resolving any
duplicate snapshots first; do not blindly recreate the unique index.

Production migration, deployment, and authenticated verification require access
to the owner's deployment environment and have not been performed locally.
