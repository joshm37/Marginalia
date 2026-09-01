BEGIN;

ALTER TYPE "AnnotationType" RENAME TO "ExcerptType";

ALTER TABLE "Annotation" RENAME TO "Excerpt";
ALTER TABLE "AnnotationProject" RENAME TO "ExcerptProject";
ALTER TABLE "AnnotationTag" RENAME TO "ExcerptTag";

ALTER TABLE "Excerpt" RENAME COLUMN "annotationType" TO "excerptType";
ALTER TABLE "ExcerptProject" RENAME COLUMN "annotationId" TO "excerptId";
ALTER TABLE "ExcerptTag" RENAME COLUMN "annotationId" TO "excerptId";

ALTER INDEX "Annotation_pkey" RENAME TO "Excerpt_pkey";
ALTER INDEX "Annotation_userId_createdAt_idx" RENAME TO "Excerpt_userId_createdAt_idx";
ALTER INDEX "Annotation_sourceId_createdAt_idx" RENAME TO "Excerpt_sourceId_createdAt_idx";
ALTER INDEX "AnnotationProject_pkey" RENAME TO "ExcerptProject_pkey";
ALTER INDEX "AnnotationProject_projectId_idx" RENAME TO "ExcerptProject_projectId_idx";
ALTER INDEX "AnnotationTag_pkey" RENAME TO "ExcerptTag_pkey";
ALTER INDEX "AnnotationTag_tagId_idx" RENAME TO "ExcerptTag_tagId_idx";

ALTER TABLE "Excerpt" RENAME CONSTRAINT "Annotation_userId_fkey" TO "Excerpt_userId_fkey";
ALTER TABLE "Excerpt" RENAME CONSTRAINT "Annotation_sourceId_fkey" TO "Excerpt_sourceId_fkey";
ALTER TABLE "ExcerptProject" RENAME CONSTRAINT "AnnotationProject_annotationId_fkey" TO "ExcerptProject_excerptId_fkey";
ALTER TABLE "ExcerptProject" RENAME CONSTRAINT "AnnotationProject_projectId_fkey" TO "ExcerptProject_projectId_fkey";
ALTER TABLE "ExcerptTag" RENAME CONSTRAINT "AnnotationTag_annotationId_fkey" TO "ExcerptTag_excerptId_fkey";
ALTER TABLE "ExcerptTag" RENAME CONSTRAINT "AnnotationTag_tagId_fkey" TO "ExcerptTag_tagId_fkey";

COMMIT;
