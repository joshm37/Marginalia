export function httpUrlOrUndefined(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

export function stripFileUrls(value: unknown): unknown {
  if (typeof value === "string") {
    const candidate = value.trim();
    const isDeviceLocalReference =
      /^file:/i.test(candidate) ||
      /^\/(?:Users|home|private|Volumes)\//.test(candidate) ||
      /^[A-Za-z]:[\\/]/.test(candidate) ||
      /^\\\\/.test(candidate);
    return isDeviceLocalReference ? undefined : value;
  }
  if (Array.isArray(value))
    return value.map(stripFileUrls).filter((item) => item !== undefined);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [key, stripFileUrls(item)] as const)
      .filter(([, item]) => item !== undefined),
  );
}

/** Normalize untrusted source input before field-level URL schemas execute. */
export function sanitizeSourceUrlsForStorage(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const source = input as Record<string, unknown>;
  if (source.storageMode !== "LOCAL") return input;
  const citationData =
    source.citationData && typeof source.citationData === "object"
      ? {
          ...(stripFileUrls(source.citationData) as Record<string, unknown>),
          url: httpUrlOrUndefined(
            (source.citationData as Record<string, unknown>).url,
          ),
        }
      : source.citationData;
  const provenance =
    source.metadataProvenance && typeof source.metadataProvenance === "object"
      ? Object.fromEntries(
          Object.entries(source.metadataProvenance as Record<string, unknown>)
            .filter(([field]) => field !== "url"),
        )
      : source.metadataProvenance;
  return {
    ...source,
    url: undefined,
    canonicalUrl: undefined,
    citationData,
    metadataProvenance: provenance,
  };
}

/** Deliberately narrow diagnostics for the opt-in local-PDF runtime trace. */
export function sourceUrlDebugSnapshot(input: unknown, endpointBeingCalled: string) {
  const source = input && typeof input === "object"
    ? input as Record<string, unknown>
    : {};
  const citationData = source.citationData && typeof source.citationData === "object"
    ? source.citationData as Record<string, unknown>
    : {};
  const citationMetadata = source.citationMetadata && typeof source.citationMetadata === "object"
    ? source.citationMetadata as Record<string, unknown>
    : {};
  return {
    storageMode: source.storageMode,
    url: source.url,
    canonicalUrl: source.canonicalUrl,
    normalizedUrl: source.normalizedUrl,
    citationDataUrl: citationData.url,
    citationMetadataUrl: citationMetadata.url ?? citationMetadata.URL,
    bibliographicUrl: citationMetadata.bibliographicUrl,
    endpointBeingCalled,
  };
}
