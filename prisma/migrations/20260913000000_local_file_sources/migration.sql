-- Add local-document identity without storing paths or file contents.
CREATE TYPE "SourceStorageMode" AS ENUM ('WEB', 'LOCAL', 'ARCHIVED');

ALTER TABLE "Source"
  ALTER COLUMN "url" DROP NOT NULL,
  ALTER COLUMN "normalizedUrl" DROP NOT NULL,
  ADD COLUMN "storageMode" "SourceStorageMode" NOT NULL DEFAULT 'WEB';

ALTER TABLE "Excerpt" ALTER COLUMN "pageUrl" DROP NOT NULL;

-- Required for the composite ownership-preserving local-file relation.
CREATE UNIQUE INDEX "Source_id_userId_key" ON "Source"("id", "userId");

CREATE TABLE "LocalFileReference" (
  "sourceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sha256" CHAR(64) NOT NULL,
  "filename" TEXT NOT NULL,
  "fileSize" BIGINT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "lastModified" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LocalFileReference_pkey" PRIMARY KEY ("sourceId", "userId"),
  CONSTRAINT "LocalFileReference_hash_check" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "LocalFileReference_filename_check" CHECK (
    char_length("filename") BETWEEN 1 AND 255
    AND "filename" !~ '[\\/]'
    AND "filename" !~ '[[:cntrl:]]'
  ),
  CONSTRAINT "LocalFileReference_size_check" CHECK ("fileSize" >= 0),
  CONSTRAINT "LocalFileReference_mime_check" CHECK (
    char_length("mimeType") BETWEEN 3 AND 255
    AND "mimeType" ~ '^[A-Za-z0-9!#$&^_.+-]+/[A-Za-z0-9!#$&^_.+-]+$'
  ),
  CONSTRAINT "LocalFileReference_sourceId_userId_fkey"
    FOREIGN KEY ("sourceId", "userId") REFERENCES "Source"("id", "userId")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Per-user uniqueness permits independent users to save the same published PDF.
CREATE UNIQUE INDEX "LocalFileReference_userId_sha256_key"
  ON "LocalFileReference"("userId", "sha256");
CREATE UNIQUE INDEX "LocalFileReference_sourceId_key"
  ON "LocalFileReference"("sourceId");
CREATE INDEX "LocalFileReference_sha256_idx"
  ON "LocalFileReference"("sha256");
