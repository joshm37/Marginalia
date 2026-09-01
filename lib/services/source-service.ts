import type {
  CreateSourceInput,
  SourceRepository,
} from "@/lib/repositories/contracts";

export class DuplicateSourceError extends Error {
  constructor(public readonly existingSource: unknown) {
    super("This source is already in your library");
  }
}

export function normalizeDoi(doi?: string) {
  const value = doi
    ?.trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/^doi:\s*/, "");
  return value || undefined;
}

export function normalizeUrl(rawUrl: string) {
  const url = new URL(rawUrl);
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

  async checkDuplicate(
    userId: string,
    values: { doi?: string; canonicalUrl?: string; url: string },
  ) {
    return this.sources.findDuplicate(userId, {
      doi: normalizeDoi(values.doi),
      canonicalUrl: values.canonicalUrl
        ? normalizeUrl(values.canonicalUrl)
        : undefined,
      normalizedUrl: normalizeUrl(values.url),
    });
  }

  delete(userId: string, sourceId: string) {
    return this.sources.delete(userId, sourceId);
  }

  moveToProject(userId: string, sourceId: string, projectId: string) {
    if (!projectId) throw new Error("A project is required");
    return this.sources.moveToProject(userId, sourceId, projectId);
  }

  updateBibliographyAnnotation(
    userId: string,
    sourceId: string,
    input: { bibliographyAnnotation: string; includeInBibliography: boolean },
  ) {
    return this.sources.updateBibliographyAnnotation(userId, sourceId, input);
  }

  update(userId: string, sourceId: string, input: CreateSourceInput) {
    if (!input.title.trim()) throw new Error("A source title is required");
    if (!input.projectIds?.length)
      throw new Error("A project is required to save a source");
    return this.sources.update(userId, sourceId, {
      ...input,
      title: input.title.trim(),
      normalizedUrl: normalizeUrl(input.url),
    });
  }

  async create(userId: string, input: CreateSourceInput) {
    if (!input.title.trim()) throw new Error("A source title is required");
    if (!input.projectIds?.length)
      throw new Error("A project is required to save a source");
    const normalizedDoi = normalizeDoi(input.doi);
    const normalizedUrl = normalizeUrl(input.url);
    const canonicalUrl = input.canonicalUrl
      ? normalizeUrl(input.canonicalUrl)
      : undefined;
    const duplicate = await this.sources.findDuplicate(userId, {
      doi: normalizedDoi,
      canonicalUrl,
      normalizedUrl,
    });
    if (duplicate) throw new DuplicateSourceError(duplicate);
    return this.sources.create(userId, {
      ...input,
      title: input.title.trim(),
      doi: normalizedDoi,
      canonicalUrl,
      normalizedUrl,
      normalizedDoi,
    });
  }
}
