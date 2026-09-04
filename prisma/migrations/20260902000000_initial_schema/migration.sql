CREATE TYPE "SourceType" AS ENUM ('ARTICLE', 'REPORT', 'CASE', 'BILL', 'BOOK', 'WEBSITE');
CREATE TYPE "CaptureMethod" AS ENUM ('EXTENSION', 'MANUAL', 'IMPORT');
CREATE TYPE "ExcerptType" AS ENUM ('EVIDENCE', 'SUMMARY', 'QUESTION', 'COUNTERARGUMENT', 'NOTE');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "displayName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Source" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "authors" TEXT,
  "organization" TEXT,
  "publicationDate" TIMESTAMP(3),
  "sourceType" "SourceType" NOT NULL,
  "url" TEXT NOT NULL,
  "canonicalUrl" TEXT,
  "normalizedUrl" TEXT NOT NULL,
  "doi" TEXT,
  "description" TEXT,
  "bibliographyAnnotation" TEXT,
  "includeInBibliography" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "citationMetadata" JSONB,
  "captureMethod" "CaptureMethod" NOT NULL DEFAULT 'MANUAL',
  "metadataNeedsReview" BOOLEAN NOT NULL DEFAULT false,
  "fileUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Project" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "color" TEXT,
  "archivedAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Tag" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Excerpt" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "selectedText" TEXT NOT NULL,
  "surroundingText" TEXT,
  "note" TEXT,
  "pageUrl" TEXT NOT NULL,
  "excerptType" "ExcerptType" NOT NULL,
  "locationData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Excerpt_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ProjectSource" (
  "projectId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectSource_pkey" PRIMARY KEY ("projectId", "sourceId")
);
CREATE TABLE "SourceTag" (
  "sourceId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  CONSTRAINT "SourceTag_pkey" PRIMARY KEY ("sourceId", "tagId")
);
CREATE TABLE "ExcerptProject" (
  "excerptId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  CONSTRAINT "ExcerptProject_pkey" PRIMARY KEY ("excerptId", "projectId")
);
CREATE TABLE "ExcerptTag" (
  "excerptId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  CONSTRAINT "ExcerptTag_pkey" PRIMARY KEY ("excerptId", "tagId")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "Source_userId_createdAt_idx" ON "Source"("userId", "createdAt" DESC);
CREATE INDEX "Source_userId_sourceType_idx" ON "Source"("userId", "sourceType");
CREATE UNIQUE INDEX "Source_userId_doi_key" ON "Source"("userId", "doi");
CREATE UNIQUE INDEX "Source_userId_canonicalUrl_key" ON "Source"("userId", "canonicalUrl");
CREATE UNIQUE INDEX "Source_userId_normalizedUrl_key" ON "Source"("userId", "normalizedUrl");
CREATE INDEX "Project_userId_updatedAt_idx" ON "Project"("userId", "updatedAt" DESC);
CREATE INDEX "Project_userId_deletedAt_isActive_idx" ON "Project"("userId", "deletedAt", "isActive");
CREATE UNIQUE INDEX "Project_userId_name_key" ON "Project"("userId", "name");
CREATE UNIQUE INDEX "Tag_userId_name_key" ON "Tag"("userId", "name");
CREATE INDEX "Excerpt_userId_createdAt_idx" ON "Excerpt"("userId", "createdAt" DESC);
CREATE INDEX "Excerpt_sourceId_createdAt_idx" ON "Excerpt"("sourceId", "createdAt" DESC);
CREATE INDEX "ProjectSource_sourceId_idx" ON "ProjectSource"("sourceId");
CREATE INDEX "SourceTag_tagId_idx" ON "SourceTag"("tagId");
CREATE INDEX "ExcerptProject_projectId_idx" ON "ExcerptProject"("projectId");
CREATE INDEX "ExcerptTag_tagId_idx" ON "ExcerptTag"("tagId");
ALTER TABLE "Source" ADD CONSTRAINT "Source_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Excerpt" ADD CONSTRAINT "Excerpt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Excerpt" ADD CONSTRAINT "Excerpt_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectSource" ADD CONSTRAINT "ProjectSource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectSource" ADD CONSTRAINT "ProjectSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SourceTag" ADD CONSTRAINT "SourceTag_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SourceTag" ADD CONSTRAINT "SourceTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExcerptProject" ADD CONSTRAINT "ExcerptProject_excerptId_fkey" FOREIGN KEY ("excerptId") REFERENCES "Excerpt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExcerptProject" ADD CONSTRAINT "ExcerptProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExcerptTag" ADD CONSTRAINT "ExcerptTag_excerptId_fkey" FOREIGN KEY ("excerptId") REFERENCES "Excerpt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExcerptTag" ADD CONSTRAINT "ExcerptTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
