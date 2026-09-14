import type {
  CreateSourceInput,
  SourceRepository,
} from "@/lib/repositories/contracts";
import { ConflictError, ValidationError } from "@/lib/api/errors";
import { normalizeDoi } from "@/lib/citations/identifiers";
import { SourceStorageMode } from "@/lib/generated/prisma/enums";
import { stripFileUrls } from "@/lib/sources/storage-url";

export { normalizeDoi } from "@/lib/citations/identifiers";

export class DuplicateSourceError extends ConflictError {
  constructor(public readonly existingSource: unknown) {
    super("This source is already in your library");
  }
}

export function normalizeUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new ValidationError("URL must use HTTP or HTTPS");
  url.hash = "";
  [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "fbclid",
    "gclid",
  ].forEach((key) => url.searchParams.delete(key));
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/$/, "") || "/";
  url.searchParams.sort();
  return url.toString();
}

export class SourceService {
  constructor(private readonly sources: SourceRepository) {}

  list(userId: string) {
    return this.sources.list(userId);
  }

  listPage(userId: string, pagination: { skip: number; take: number; q?: string; type?: string; projectId?: string; tag?: string; reviewOnly?: boolean; sort?: string }) {
    return this.sources.listPage(userId, pagination);
  }

  async checkDuplicate(
    userId: string,
    values: { doi?: string; canonicalUrl?: string; url?: string; localFileHash?: string },
  ) {
    return this.sources.findDuplicate(userId, {
      doi: normalizeDoi(values.doi),
      canonicalUrl: values.canonicalUrl
        ? normalizeUrl(values.canonicalUrl)
        : undefined,
      normalizedUrl: values.url ? normalizeUrl(values.url) : undefined,
      localFileHash: values.localFileHash?.toLowerCase(),
    });
  }

  delete(userId: string, sourceId: string) {
    return this.sources.delete(userId, sourceId);
  }

  moveToProject(userId: string, sourceId: string, projectId: string) {
    if (!projectId) throw new ValidationError("A project is required");
    return this.sources.moveToProject(userId, sourceId, projectId);
  }

  updateBibliographyAnnotation(
    userId: string,
    sourceId: string,
    input: { bibliographyAnnotation: string; includeInBibliography: boolean },
  ) {
    return this.sources.updateBibliographyAnnotation(userId, sourceId, input);
  }

  async update(userId: string, sourceId: string, input: CreateSourceInput) {
    if (!input.title.trim())
      throw new ValidationError("A source title is required");
    if (!input.projectIds?.length)
      throw new ValidationError("A project is required to save a source");
    const storageMode = input.storageMode ?? SourceStorageMode.WEB;
    if (storageMode === SourceStorageMode.WEB && !input.url)
      throw new ValidationError("A web source URL is required");
    if (input.storageMode === SourceStorageMode.LOCAL && !input.localFile)
      throw new ValidationError("Local file metadata is required");
    const normalizedDoi = normalizeDoi(input.doi);
    const sourceUrl = storageMode === SourceStorageMode.LOCAL ? undefined : input.url;
    const canonicalUrl = storageMode === SourceStorageMode.LOCAL
      ? undefined
      : input.canonicalUrl
      ? normalizeUrl(input.canonicalUrl)
      : undefined;
    const normalizedUrl = sourceUrl ? normalizeUrl(sourceUrl) : undefined;
    const localFileHash = input.localFile?.sha256.toLowerCase();
    const duplicate = await this.sources.findDuplicate(userId, {
      doi: normalizedDoi,
      canonicalUrl,
      normalizedUrl,
      localFileHash,
    });
    if (duplicate && (duplicate as { id?: unknown }).id !== sourceId)
      throw new DuplicateSourceError(duplicate);
    return this.sources.update(userId, sourceId, {
      ...input,
      url: sourceUrl,
      storageMode,
      title: input.title.trim(),
      doi: normalizedDoi,
      canonicalUrl,
      normalizedUrl,
      citationMetadata: stripFileUrls(input.citationMetadata) as Record<string, unknown> | undefined,
      localFile: input.localFile
        ? { ...input.localFile, sha256: input.localFile.sha256.toLowerCase() }
        : input.localFile,
    });
  }

  async create(userId: string, input: CreateSourceInput) {
    if (!input.title.trim())
      throw new ValidationError("A source title is required");
    if (!input.projectIds?.length)
      throw new ValidationError("A project is required to save a source");
    const storageMode = input.storageMode ?? SourceStorageMode.WEB;
    if (storageMode === SourceStorageMode.WEB && !input.url)
      throw new ValidationError("A web source URL is required");
    if (storageMode === SourceStorageMode.LOCAL && !input.localFile)
      throw new ValidationError("Local file metadata is required");
    const normalizedDoi = normalizeDoi(input.doi);
    const sourceUrl = storageMode === SourceStorageMode.LOCAL ? undefined : input.url;
    const normalizedUrl = sourceUrl ? normalizeUrl(sourceUrl) : undefined;
    const canonicalUrl = storageMode === SourceStorageMode.LOCAL
      ? undefined
      : input.canonicalUrl
      ? normalizeUrl(input.canonicalUrl)
      : undefined;
    const duplicate = await this.sources.findDuplicate(userId, {
      doi: normalizedDoi,
      canonicalUrl,
      normalizedUrl,
      localFileHash: input.localFile?.sha256.toLowerCase(),
    });
    if (duplicate) throw new DuplicateSourceError(duplicate);
    return this.sources.create(userId, {
      ...input,
      url: sourceUrl,
      title: input.title.trim(),
      doi: normalizedDoi,
      canonicalUrl,
      normalizedUrl,
      normalizedDoi,
      storageMode,
      citationMetadata: stripFileUrls(input.citationMetadata) as Record<string, unknown> | undefined,
      localFile: input.localFile
        ? { ...input.localFile, sha256: input.localFile.sha256.toLowerCase() }
        : input.localFile,
    });
  }
}
