BEGIN;

UPDATE "Excerpt"
SET "excerptType" = 'NOTE'
WHERE "excerptType" = 'QUOTE';

ALTER TYPE "ExcerptType" RENAME TO "ExcerptType_old";

CREATE TYPE "ExcerptType" AS ENUM (
  'EVIDENCE',
  'SUMMARY',
  'QUESTION',
  'COUNTERARGUMENT',
  'NOTE'
);

ALTER TABLE "Excerpt"
ALTER COLUMN "excerptType" TYPE "ExcerptType"
USING "excerptType"::text::"ExcerptType";

DROP TYPE "ExcerptType_old";

COMMIT;
