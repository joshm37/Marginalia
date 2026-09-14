-- Promote commonly queried citation metadata and preserve legacy display data.
CREATE TYPE "ContributorRole" AS ENUM ('AUTHOR', 'EDITOR', 'TRANSLATOR');

ALTER TABLE "Source"
  ADD COLUMN "containerTitle" TEXT,
  ADD COLUMN "volume" TEXT,
  ADD COLUMN "issue" TEXT,
  ADD COLUMN "pages" TEXT,
  ADD COLUMN "publisher" TEXT,
  ADD COLUMN "publisherPlace" TEXT,
  ADD COLUMN "edition" TEXT,
  ADD COLUMN "isbn" TEXT,
  ADD COLUMN "issn" TEXT,
  ADD COLUMN "accessedDate" TIMESTAMP(3),
  ADD COLUMN "language" TEXT;

CREATE TABLE "Contributor" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "given" TEXT,
  "family" TEXT,
  "literal" TEXT,
  "suffix" TEXT,
  "isLegacy" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Contributor_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Contributor_name_check" CHECK (
    COALESCE(NULLIF(BTRIM("given"), ''), NULLIF(BTRIM("family"), ''), NULLIF(BTRIM("literal"), '')) IS NOT NULL
  )
);

CREATE TABLE "SourceContributor" (
  "sourceId" TEXT NOT NULL,
  "contributorId" TEXT NOT NULL,
  "role" "ContributorRole" NOT NULL,
  "sequence" INTEGER NOT NULL,
  CONSTRAINT "SourceContributor_pkey" PRIMARY KEY ("sourceId", "contributorId", "role")
);

CREATE UNIQUE INDEX "SourceContributor_sourceId_role_sequence_key"
  ON "SourceContributor"("sourceId", "role", "sequence");
CREATE INDEX "SourceContributor_contributorId_idx" ON "SourceContributor"("contributorId");
CREATE INDEX "Contributor_userId_family_given_idx" ON "Contributor"("userId", "family", "given");
CREATE INDEX "Contributor_userId_literal_idx" ON "Contributor"("userId", "literal");
CREATE INDEX "Source_userId_containerTitle_idx" ON "Source"("userId", "containerTitle");

ALTER TABLE "Contributor" ADD CONSTRAINT "Contributor_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SourceContributor" ADD CONSTRAINT "SourceContributor_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SourceContributor" ADD CONSTRAINT "SourceContributor_contributorId_fkey"
  FOREIGN KEY ("contributorId") REFERENCES "Contributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill first-class scalar fields from the old normalized JSON document.
UPDATE "Source" SET
  "containerTitle" = NULLIF("citationMetadata"->>'containerTitle', ''),
  "volume" = NULLIF("citationMetadata"->>'volume', ''),
  "issue" = NULLIF("citationMetadata"->>'issue', ''),
  "pages" = NULLIF("citationMetadata"->>'pages', ''),
  "publisher" = COALESCE(NULLIF("citationMetadata"->>'publisher', ''), "organization"),
  "publisherPlace" = NULLIF("citationMetadata"->>'publisherPlace', ''),
  "edition" = NULLIF("citationMetadata"->>'edition', ''),
  "language" = NULLIF("citationMetadata"->>'language', '')
WHERE "citationMetadata" IS NOT NULL;

-- Existing records predate field-level provenance. Queue them for one review
-- instead of pretending their origin and confidence are known.
UPDATE "Source" SET "metadataNeedsReview" = true;

UPDATE "Source" s SET "isbn" = aggregated.joined
FROM (
  SELECT src.id, string_agg(item.value, ', ' ORDER BY item.ordinality) AS joined
  FROM "Source" src
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(src."citationMetadata"->'isbn') = 'array'
      THEN src."citationMetadata"->'isbn' ELSE '[]'::jsonb END
  ) WITH ORDINALITY item(value, ordinality)
  GROUP BY src.id
) aggregated WHERE s.id = aggregated.id;

UPDATE "Source" s SET "issn" = aggregated.joined
FROM (
  SELECT src.id, string_agg(item.value, ', ' ORDER BY item.ordinality) AS joined
  FROM "Source" src
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(src."citationMetadata"->'issn') = 'array'
      THEN src."citationMetadata"->'issn' ELSE '[]'::jsonb END
  ) WITH ORDINALITY item(value, ordinality)
  GROUP BY src.id
) aggregated WHERE s.id = aggregated.id;

UPDATE "Source"
SET "accessedDate" = to_date(
  ("citationMetadata"->'accessed'->'date-parts'->0->>0) || '-' ||
  COALESCE("citationMetadata"->'accessed'->'date-parts'->0->>1, '1') || '-' ||
  COALESCE("citationMetadata"->'accessed'->'date-parts'->0->>2, '1'),
  'YYYY-MM-DD'
)::timestamp
WHERE ("citationMetadata"->'accessed'->'date-parts'->0->>0) ~ '^[0-9]{4}$'
  AND COALESCE("citationMetadata"->'accessed'->'date-parts'->0->>1, '1') ~ '^[0-9]{1,2}$'
  AND COALESCE("citationMetadata"->'accessed'->'date-parts'->0->>2, '1') ~ '^[0-9]{1,2}$';

-- Structured JSON names are authoritative and retain their exact order and role.
WITH names AS (
  SELECT s.id AS source_id, s."userId" AS user_id, role_data.role,
         item.ordinality::integer - 1 AS sequence, item.value AS person
  FROM "Source" s
  CROSS JOIN LATERAL (VALUES
    ('AUTHOR'::"ContributorRole", s."citationMetadata"->'authors'),
    ('EDITOR'::"ContributorRole", s."citationMetadata"->'editors'),
    ('TRANSLATOR'::"ContributorRole", s."citationMetadata"->'translators')
  ) role_data(role, people)
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(role_data.people) = 'array'
      THEN role_data.people ELSE '[]'::jsonb END
  ) WITH ORDINALITY item(value, ordinality)
  WHERE jsonb_typeof(item.value) = 'object'
    AND COALESCE(item.value->>'given', item.value->>'family', item.value->>'literal') IS NOT NULL
), inserted AS (
  INSERT INTO "Contributor" ("id", "userId", "given", "family", "literal", "suffix", "isLegacy")
  SELECT 'ctr_' || md5(source_id || ':' || role::text || ':' || sequence::text), user_id,
         NULLIF(person->>'given', ''), NULLIF(person->>'family', ''),
         NULLIF(person->>'literal', ''), NULLIF(person->>'suffix', ''), false
  FROM names
  ON CONFLICT DO NOTHING
)
INSERT INTO "SourceContributor" ("sourceId", "contributorId", "role", "sequence")
SELECT source_id, 'ctr_' || md5(source_id || ':' || role::text || ':' || sequence::text), role, sequence
FROM names ON CONFLICT DO NOTHING;

-- If no structured authors exist, preserve the complete legacy display string as
-- one explicitly marked legacy value. Application compatibility code continues
-- to parse it at render time, so ambiguous text is never destructively split.
INSERT INTO "Contributor" ("id", "userId", "literal", "isLegacy")
SELECT 'ctr_' || md5(s.id || ':AUTHOR:legacy'), s."userId", s."authors", true
FROM "Source" s
WHERE NULLIF(BTRIM(s."authors"), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "SourceContributor" sc WHERE sc."sourceId" = s.id AND sc.role = 'AUTHOR'
  );

INSERT INTO "SourceContributor" ("sourceId", "contributorId", "role", "sequence")
SELECT s.id, 'ctr_' || md5(s.id || ':AUTHOR:legacy'), 'AUTHOR', 0
FROM "Source" s
WHERE NULLIF(BTRIM(s."authors"), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "SourceContributor" sc WHERE sc."sourceId" = s.id AND sc.role = 'AUTHOR'
  );

-- Remove newly authoritative values from JSON. Uncommon CSL/provider fields remain.
UPDATE "Source"
SET "citationMetadata" = "citationMetadata" - ARRAY[
  'title', 'type', 'authors', 'editors', 'translators', 'containerTitle',
  'volume', 'issue', 'pages', 'publisher', 'publisherPlace', 'edition',
  'url', 'doi', 'isbn', 'issn', 'language'
]::text[]
WHERE "citationMetadata" IS NOT NULL;
