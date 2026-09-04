import { z } from "zod";

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
  .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
    message: "URL must use HTTP or HTTPS",
  });

const citationNameSchema = z.object({
  given: optionalText(300),
  family: optionalText(300),
  literal: optionalText(500),
  suffix: optionalText(100),
});
const citationDateSchema = z.object({
  "date-parts": z.array(z.array(z.number().int()).min(1).max(3)).min(1).max(2),
});
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
  url: httpUrl.optional(),
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

export const sourceInputSchema = z.object({
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
  url: httpUrl,
  canonicalUrl: httpUrl.optional().or(z.literal("")),
  doi: optionalText(500),
  description: optionalText(10_000),
  bibliographyAnnotation: optionalText(50_000),
  notes: optionalText(50_000),
  citationData: citationDataSchema.optional(),
  projects: projectIds.refine(
    (values) => values.length > 0,
    "A project is required",
  ),
  tags: tagNames,
});

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
  })
  .refine((value) => value.pageUrl || value.url, {
    message: "Page URL is required",
    path: ["pageUrl"],
  });

export const duplicateQuerySchema = z.object({
  url: httpUrl,
  doi: optionalText(500),
  canonicalUrl: httpUrl.optional(),
});

export const analyzeSchema = z.object({ url: httpUrl });
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export const doiEnrichmentSchema = z.object({
  doi: z.string().trim().min(1).max(500),
});
export const citationFormatSchema = z.object({
  style: z.enum(["APA", "MLA", "Chicago"]),
  source: sourceInputSchema.omit({ projects: true, tags: true }).extend({
    id: z.string().max(128).optional(),
    projects: projectIds.optional(),
    tags: tagNames.optional(),
    createdAt: z.string().max(40).optional(),
  }),
});
export const extensionLoginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(1024),
});
export const extensionRefreshSchema = z.object({
  refreshToken: z.string().min(1).max(4096),
});
