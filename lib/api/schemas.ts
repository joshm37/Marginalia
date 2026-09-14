import { z } from "zod";
import { citationStyleIds } from "@/lib/citations/style-registry";
import { sanitizeSourceUrlsForStorage } from "@/lib/sources/storage-url";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));
export const resourceIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "Resource ID is invalid");
const id = resourceIdSchema;
const tagNames = z.array(z.string().trim().min(1).max(80)).max(50).default([]);
const projectIds = z.array(id).max(25).default([]);
const httpUrl = z
  .string()
  .trim()
  .url()
  .max(4096)
  .refine(
    (value) => {
      try {
        return ["http:", "https:"].includes(new URL(value).protocol);
      } catch {
        return false;
      }
    },
    { message: "URL must use HTTP or HTTPS" },
  );

const citationNameSchema = z.object({
  given: optionalText(300),
  family: optionalText(300),
  literal: optionalText(500),
  suffix: optionalText(100),
});
const citationDateSchema = z.object({
  "date-parts": z.array(z.array(z.number().int()).min(1).max(3)).min(1).max(2),
});
const metadataProviderSchema = z.enum([
  "USER",
  "CROSSREF",
  "HTML_CITATION_META",
  "JSON_LD",
  "DUBLIN_CORE",
  "PRISM",
  "OPEN_GRAPH",
  "HTML_GENERIC",
  "PDF_METADATA",
  "URL_INFERENCE",
  "PUBMED",
  "OPENALEX",
  "ISBN_PROVIDER",
]);
const metadataConfidenceSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
const metadataFieldSchema = z.enum([
  "title", "authors", "editors", "translators", "publisher",
  "publicationDate", "accessedDate", "containerTitle", "volume", "issue", "pages",
  "edition", "publisherPlace", "doi", "isbn", "issn", "language",
  "description", "url", "sourceType",
]);
const provenanceValueSchema = z.object({
  value: z.unknown(),
  provider: metadataProviderSchema,
  confidence: metadataConfidenceSchema,
  reviewed: z.boolean(),
});
export const metadataProvenanceSchema = z
  .partialRecord(metadataFieldSchema, provenanceValueSchema)
  .default({});
export const citationDataSchema = z.object({
  title: z.string().max(1000),
  type: z.string().max(100),
  authors: z.array(citationNameSchema).max(100),
  editors: z.array(citationNameSchema).max(100).optional(),
  translators: z.array(citationNameSchema).max(100).optional(),
  containerTitle: optionalText(1000),
  collectionTitle: optionalText(1000),
  volume: optionalText(100),
  issue: optionalText(100),
  pages: optionalText(100),
  edition: optionalText(100),
  publisher: optionalText(500),
  publisherPlace: optionalText(500),
  issued: citationDateSchema.optional(),
  accessed: citationDateSchema.optional(),
  url: httpUrl.optional().or(z.literal("")),
  doi: optionalText(500),
  isbn: z.array(z.string().max(100)).max(20).optional(),
  issn: z.array(z.string().max(100)).max(20).optional(),
  language: optionalText(100),
  abstract: optionalText(50_000),
});

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(160),
  description: optionalText(2000),
});

export const projectActionSchema = z.object({
  action: z.enum(["archive", "unarchive"]),
});

export const accountDeletionSchema = z.object({
  confirmation: z.literal("DELETE"),
});

export const localFileInputSchema = z.object({
  sha256: z.string().trim().regex(/^[a-fA-F0-9]{64}$/, "File hash must be a SHA-256 value").transform((value) => value.toLowerCase()),
  filename: z.string().trim().min(1, "Filename is required").max(255).refine(
    (value) => !/[\\/\u0000-\u001f\u007f]/.test(value),
    "Filename must not contain a path or control characters",
  ),
  fileSize: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  mimeType: z.string().trim().min(3).max(255).regex(
    /^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/,
    "MIME type is invalid",
  ).transform((value) => value.toLowerCase()),
  lastModified: z.string().datetime({ offset: true }).transform((value) => new Date(value)).optional(),
});

const sourceInputBaseSchema = z.object({
  title: z.string().trim().min(1, "Source title is required").max(1000),
  authors: optionalText(3000),
  organization: optionalText(500),
  containerTitle: optionalText(1000),
  volume: optionalText(100),
  issue: optionalText(100),
  pages: optionalText(100),
  editors: optionalText(3000),
  translators: optionalText(3000),
  edition: optionalText(100),
  publisherPlace: optionalText(500),
  isbn: optionalText(500),
  issn: optionalText(500),
  accessedDate: z
    .string()
    .trim()
    .max(40)
    .refine(
      (value) => !value || !Number.isNaN(Date.parse(value)),
      "Access date is invalid",
    )
    .optional()
    .or(z.literal("")),
  date: z
    .string()
    .trim()
    .max(40)
    .refine(
      (value) => !value || !Number.isNaN(Date.parse(value)),
      "Publication date is invalid",
    )
    .optional()
    .or(z.literal("")),
  type: z
    .enum(["Article", "Report", "Case", "Bill", "Book", "Website"])
    .default("Article"),
  url: httpUrl.optional().or(z.literal("")),
  canonicalUrl: httpUrl.optional().or(z.literal("")),
  doi: optionalText(500),
  description: optionalText(10_000),
  bibliographyAnnotation: optionalText(50_000),
  notes: optionalText(50_000),
  citationData: citationDataSchema.optional(),
  metadataProvenance: metadataProvenanceSchema.optional(),
  reviewedFields: z.array(metadataFieldSchema).max(25).optional(),
  storageMode: z.enum(["WEB", "LOCAL", "ARCHIVED"]).optional(),
  localFile: localFileInputSchema.optional(),
  projects: projectIds.refine(
    (values) => values.length > 0,
    "A project is required",
  ),
  tags: tagNames,
});

const validatedSourceInputSchema = sourceInputBaseSchema.superRefine((value, context) => {
  const mode = value.storageMode ?? "WEB";
  if (mode === "WEB" && !value.url)
    context.addIssue({ code: "custom", message: "A web source URL is required", path: ["url"] });
  if (mode === "LOCAL" && !value.localFile)
    context.addIssue({ code: "custom", message: "Local file metadata is required", path: ["localFile"] });
  if (mode === "ARCHIVED")
    context.addIssue({ code: "custom", message: "Archived file creation is not available yet", path: ["storageMode"] });
});
export const sourceInputSchema = z.preprocess(
  sanitizeSourceUrlsForStorage,
  validatedSourceInputSchema,
);

export const sourceBibliographySchema = z.object({
  action: z.literal("updateBibliographyAnnotation"),
  bibliographyAnnotation: z.string().max(50_000).default(""),
  includeInBibliography: z.boolean().default(true),
});

export const sourceMoveSchema = z.object({ projectId: id });
export const sourcePatchSchema = z.union([
  sourceBibliographySchema,
  sourceInputSchema,
  sourceMoveSchema,
]);

export const excerptInputSchema = z
  .object({
    sourceId: id,
    selectedText: z
      .string()
      .trim()
      .min(1, "Excerpt text is required")
      .max(100_000),
    surroundingText: optionalText(100_000),
    note: optionalText(50_000),
    pageUrl: httpUrl.optional(),
    url: httpUrl.optional(),
    type: z
      .enum(["Evidence", "Summary", "Question", "Counterargument", "Note"])
      .default("Note"),
    locationData: z.record(z.string(), z.unknown()).optional(),
    projects: projectIds.refine(
      (values) => values.length > 0,
      "A project is required",
    ),
    tags: tagNames,
  });

export const duplicateQuerySchema = z.object({
  url: httpUrl.optional(),
  doi: optionalText(500),
  canonicalUrl: httpUrl.optional(),
  fileHash: z.string().trim().regex(/^[a-fA-F0-9]{64}$/, "File hash must be a SHA-256 value").transform((value) => value.toLowerCase()).optional(),
}).refine((value) => value.url || value.doi || value.canonicalUrl || value.fileHash, {
  message: "A URL, DOI, canonical URL, or file hash is required",
});

export const analyzeSchema = z.object({ url: httpUrl });
export const localDocumentEnrichmentSchema = z
  .object({
    doi: optionalText(500),
    isbn: optionalText(32),
    title: optionalText(2_000),
    authors: z.array(z.string().trim().min(1).max(500)).max(100).default([]),
    date: z.string().trim().max(40).optional(),
    description: optionalText(10_000),
  })
  .refine((value) => value.doi || value.isbn, {
    message: "A DOI or ISBN is required for enrichment",
  });
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export const sourceListQuerySchema = paginationSchema.extend({
  q: optionalText(500),
  type: z.enum(["Article", "Report", "Case", "Bill", "Book", "Website"]).optional(),
  projectId: id.optional(),
  tag: optionalText(80),
  reviewOnly: z.enum(["true", "false"]).optional(),
  sort: z.enum(["newest", "oldest", "title", "author", "publication", "project", "tag"]).default("newest"),
});
export const excerptListQuerySchema = paginationSchema.extend({
  q: optionalText(500),
  sourceId: id.optional(),
  projectId: id.optional(),
  tag: optionalText(80),
  type: z.enum(["Evidence", "Summary", "Question", "Counterargument", "Note"]).optional(),
  sort: z.enum(["newest", "oldest", "source", "project", "tag", "type"]).default("newest"),
});
export const doiEnrichmentSchema = z.object({
  doi: z.string().trim().min(1).max(500),
});
const citationSourceSchema = sourceInputBaseSchema.omit({ projects: true, tags: true, citationData: true, localFile: true }).extend({
    citationData: citationDataSchema.partial().optional(),
    id: z.string().max(128).optional(),
    projects: projectIds.optional(),
    tags: tagNames.optional(),
    createdAt: z.string().max(40).optional(),
  });
export const citationFormatSchema = z.object({
  style: z.enum(citationStyleIds),
  source: citationSourceSchema,
});
export const bibliographyFormatSchema = z.object({ style: z.enum(citationStyleIds), sources: z.array(citationSourceSchema).min(1).max(500), preserveOrder: z.boolean().default(false) });
export const extensionLoginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(1024),
});
export const extensionRefreshSchema = z.object({
  refreshToken: z.string().min(1).max(4096),
});
