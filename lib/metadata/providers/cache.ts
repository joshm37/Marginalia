import type { MetadataProviderResult } from "@/lib/metadata/providers/types";

const SUCCESS_TTL = 24 * 60 * 60 * 1000;
const FAILURE_TTL = 5 * 60 * 1000;

export class ProviderCache {
  private readonly values = new Map<
    string,
    { expiresAt: number; result: MetadataProviderResult }
  >();

  get(key: string) {
    const cached = this.values.get(key);
    if (!cached || cached.expiresAt <= Date.now()) {
      if (cached) this.values.delete(key);
      return undefined;
    }
    return { ...cached.result, cacheHit: true };
  }

  set(key: string, result: MetadataProviderResult) {
    this.values.set(key, {
      expiresAt:
        Date.now() + (result.status === "SUCCESS" ? SUCCESS_TTL : FAILURE_TTL),
      result: { ...result, cacheHit: false },
    });
    return result;
  }

  clear() {
    this.values.clear();
  }
}

export function providerFailure(
  provider: MetadataProviderResult["provider"],
  error: unknown,
): MetadataProviderResult {
  const timeout =
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError");
  return {
    provider,
    status: timeout ? "TIMEOUT" : "FAILED",
    candidate: null,
    cacheHit: false,
    failureReason: timeout
      ? "Provider request timed out"
      : error instanceof Error
        ? error.message
        : "Provider request failed",
  };
}

export function retryAfterSeconds(response: Response) {
  const value = response.headers.get("retry-after");
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));
  const date = Date.parse(value);
  return Number.isNaN(date)
    ? undefined
    : Math.max(0, Math.ceil((date - Date.now()) / 1000));
}
