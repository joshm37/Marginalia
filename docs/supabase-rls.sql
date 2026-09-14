-- Run in the Supabase SQL editor after reviewing against the target schema.
-- Prisma remains protected by application-level userId constraints. These policies
-- protect access through Supabase's authenticated Data API role.

alter table public."User" enable row level security;
alter table public."Source" enable row level security;
alter table public."Project" enable row level security;
alter table public."Tag" enable row level security;
alter table public."Excerpt" enable row level security;
alter table public."ProjectSource" enable row level security;
alter table public."SourceTag" enable row level security;
alter table public."ExcerptProject" enable row level security;
alter table public."ExcerptTag" enable row level security;
alter table public."RateLimitBucket" enable row level security;
alter table public."Contributor" enable row level security;
alter table public."SourceContributor" enable row level security;
alter table public."LocalFileReference" enable row level security;

create policy "users_own_row" on public."User"
for all to authenticated
using (id = (select auth.uid())::text)
with check (id = (select auth.uid())::text);

create policy "sources_owned_by_user" on public."Source"
for all to authenticated
using ("userId" = (select auth.uid())::text)
with check ("userId" = (select auth.uid())::text);

create policy "local_files_owned_by_user" on public."LocalFileReference"
for all to authenticated
using (
  "userId" = (select auth.uid())::text
  and exists (select 1 from public."Source" s where s.id = "sourceId" and s."userId" = (select auth.uid())::text)
)
with check (
  "userId" = (select auth.uid())::text
  and exists (select 1 from public."Source" s where s.id = "sourceId" and s."userId" = (select auth.uid())::text)
);

create policy "projects_owned_by_user" on public."Project"
for all to authenticated
using ("userId" = (select auth.uid())::text)
with check ("userId" = (select auth.uid())::text);

create policy "tags_owned_by_user" on public."Tag"
for all to authenticated
using ("userId" = (select auth.uid())::text)
with check ("userId" = (select auth.uid())::text);

create policy "excerpts_owned_by_user" on public."Excerpt"
for all to authenticated
using ("userId" = (select auth.uid())::text)
with check ("userId" = (select auth.uid())::text);

create policy "contributors_owned_by_user" on public."Contributor"
for all to authenticated
using ("userId" = (select auth.uid())::text)
with check ("userId" = (select auth.uid())::text);

create policy "source_contributors_owned_by_user" on public."SourceContributor"
for all to authenticated
using (
  exists (select 1 from public."Source" s where s.id = "sourceId" and s."userId" = (select auth.uid())::text)
  and exists (select 1 from public."Contributor" c where c.id = "contributorId" and c."userId" = (select auth.uid())::text)
)
with check (
  exists (select 1 from public."Source" s where s.id = "sourceId" and s."userId" = (select auth.uid())::text)
  and exists (select 1 from public."Contributor" c where c.id = "contributorId" and c."userId" = (select auth.uid())::text)
);

create policy "project_sources_owned_by_user" on public."ProjectSource"
for all to authenticated
using (
  exists (select 1 from public."Project" p where p.id = "projectId" and p."userId" = (select auth.uid())::text)
  and exists (select 1 from public."Source" s where s.id = "sourceId" and s."userId" = (select auth.uid())::text)
)
with check (
  exists (select 1 from public."Project" p where p.id = "projectId" and p."userId" = (select auth.uid())::text)
  and exists (select 1 from public."Source" s where s.id = "sourceId" and s."userId" = (select auth.uid())::text)
);

create policy "source_tags_owned_by_user" on public."SourceTag"
for all to authenticated
using (
  exists (select 1 from public."Source" s where s.id = "sourceId" and s."userId" = (select auth.uid())::text)
  and exists (select 1 from public."Tag" t where t.id = "tagId" and t."userId" = (select auth.uid())::text)
)
with check (
  exists (select 1 from public."Source" s where s.id = "sourceId" and s."userId" = (select auth.uid())::text)
  and exists (select 1 from public."Tag" t where t.id = "tagId" and t."userId" = (select auth.uid())::text)
);

create policy "excerpt_projects_owned_by_user" on public."ExcerptProject"
for all to authenticated
using (
  exists (select 1 from public."Excerpt" e where e.id = "excerptId" and e."userId" = (select auth.uid())::text)
  and exists (select 1 from public."Project" p where p.id = "projectId" and p."userId" = (select auth.uid())::text)
)
with check (
  exists (select 1 from public."Excerpt" e where e.id = "excerptId" and e."userId" = (select auth.uid())::text)
  and exists (select 1 from public."Project" p where p.id = "projectId" and p."userId" = (select auth.uid())::text)
);

create policy "excerpt_tags_owned_by_user" on public."ExcerptTag"
for all to authenticated
using (
  exists (select 1 from public."Excerpt" e where e.id = "excerptId" and e."userId" = (select auth.uid())::text)
  and exists (select 1 from public."Tag" t where t.id = "tagId" and t."userId" = (select auth.uid())::text)
)
with check (
  exists (select 1 from public."Excerpt" e where e.id = "excerptId" and e."userId" = (select auth.uid())::text)
  and exists (select 1 from public."Tag" t where t.id = "tagId" and t."userId" = (select auth.uid())::text)
);

-- RateLimitBucket intentionally has no authenticated policy. It is server-only.
