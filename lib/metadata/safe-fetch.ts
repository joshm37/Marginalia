import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { AnalysisStatus, RetrievalDiagnostics } from "@/lib/metadata/types";

export const MAX_HTML_BYTES = 1_000_000;
export const MAX_REDIRECTS = 5;
export const FETCH_TIMEOUT_MS = 10_000;

type SafeFetchResult = {
  status: "OK" | Extract<AnalysisStatus, "FETCH_FAILED" | "BLOCKED" | "NON_HTML">;
  html?: string;
  diagnostics: RetrievalDiagnostics;
  warning?: string;
};

class UnsafeUrlError extends Error {}

function isPrivateAddress(rawAddress: string) {
  const address = rawAddress.toLowerCase().replace(/^::ffff:/, "");
  if (address === "::" || address === "::1" || address === "0.0.0.0") return true;
  if (address.startsWith("10.") || address.startsWith("127.") || address.startsWith("0.")) return true;
  if (address.startsWith("192.168.") || address.startsWith("169.254.")) return true;
  const carrierGradeNat = address.match(/^100\.(\d+)\./);
  if (
    carrierGradeNat &&
    Number(carrierGradeNat[1]) >= 64 &&
    Number(carrierGradeNat[1]) <= 127
  )
    return true;
  const match = address.match(/^172\.(\d+)\./);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
  return (
    address.startsWith("fc") ||
    address.startsWith("fd") ||
    address.startsWith("fe80:") ||
    address.startsWith("ff")
  );
}

async function publicUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("Enter a valid webpage URL");
  }
  if (!['http:', 'https:'].includes(url.protocol))
    throw new UnsafeUrlError("Only HTTP and HTTPS links can be analyzed");
  if (url.username || url.password)
    throw new UnsafeUrlError("Links containing credentials cannot be analyzed");
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost"))
    throw new UnsafeUrlError("Private or local network links cannot be analyzed");
  const addresses = isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address)))
    throw new UnsafeUrlError("Private or local network links cannot be analyzed");
  return url;
}

function baseDiagnostics(requestedUrl: string): RetrievalDiagnostics {
  return {
    requestedUrl,
    responseSize: 0,
    redirectCount: 0,
    receivedHtml: false,
    truncated: false,
  };
}

export async function safeFetchHtml(
  requestedUrl: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<SafeFetchResult> {
  const diagnostics = baseDiagnostics(requestedUrl);
  let url: URL;
  try {
    url = await publicUrl(requestedUrl);
  } catch (error) {
    const blocked = error instanceof UnsafeUrlError;
    const failureReason =
      error instanceof Error
        ? blocked
          ? error.message
          : `The webpage host could not be resolved: ${error.message}`
        : "The webpage host could not be resolved";
    return {
      status: blocked ? "BLOCKED" : "FETCH_FAILED",
      diagnostics: { ...diagnostics, failureReason },
      warning: failureReason,
    };
  }

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    diagnostics.redirectCount = redirectCount;
    diagnostics.finalUrl = url.toString();
    let response: Response;
    try {
      response = await fetchImplementation(url, {
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent":
            "Marginalia/1.0 (+https://github.com/joshm37/Marginalia; citation metadata fetcher)",
        },
      });
    } catch (error) {
      const failureReason =
        error instanceof Error && error.name === "TimeoutError"
          ? "The website did not respond within 10 seconds"
          : error instanceof Error
            ? `The webpage could not be fetched: ${error.message}`
            : "The webpage could not be fetched";
      return {
        status: "FETCH_FAILED",
        diagnostics: { ...diagnostics, failureReason },
        warning: failureReason,
      };
    }

    diagnostics.httpStatus = response.status;
    diagnostics.contentType = response.headers.get("content-type") ?? "";
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        const failureReason = "The website returned a redirect without a destination";
        return { status: "FETCH_FAILED", diagnostics: { ...diagnostics, failureReason }, warning: failureReason };
      }
      if (redirectCount === MAX_REDIRECTS) {
        const failureReason = "The website redirected more than 5 times";
        return { status: "FETCH_FAILED", diagnostics: { ...diagnostics, failureReason }, warning: failureReason };
      }
      try {
        url = await publicUrl(new URL(location, url).toString());
      } catch (error) {
        const blocked = error instanceof UnsafeUrlError;
        const failureReason = error instanceof Error
          ? blocked
            ? `Redirect blocked: ${error.message}`
            : `The redirected host could not be resolved: ${error.message}`
          : "The redirected host could not be resolved";
        return {
          status: blocked ? "BLOCKED" : "FETCH_FAILED",
          diagnostics: { ...diagnostics, failureReason },
          warning: failureReason,
        };
      }
      continue;
    }

    if (!response.ok) {
      const blocked = [401, 403, 406, 429].includes(response.status);
      const failureReason = blocked
        ? `The website blocked metadata retrieval (HTTP ${response.status})`
        : `The website returned HTTP ${response.status}`;
      return {
        status: blocked ? "BLOCKED" : "FETCH_FAILED",
        diagnostics: { ...diagnostics, failureReason },
        warning: failureReason,
      };
    }

    if (!/^\s*(text\/html|application\/xhtml\+xml)(?:\s*;|\s*$)/i.test(diagnostics.contentType)) {
      const failureReason = `The link returned ${diagnostics.contentType || "an unknown content type"}, not HTML`;
      return { status: "NON_HTML", diagnostics: { ...diagnostics, failureReason }, warning: failureReason };
    }

    const reader = response.body?.getReader();
    if (!reader) {
      const failureReason = "The website returned no readable response body";
      return { status: "FETCH_FAILED", diagnostics: { ...diagnostics, failureReason }, warning: failureReason };
    }
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size <= MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = MAX_HTML_BYTES + 1 - size;
      chunks.push(value.byteLength > remaining ? value.slice(0, remaining) : value);
      size += Math.min(value.byteLength, remaining);
      if (size > MAX_HTML_BYTES) {
        diagnostics.truncated = true;
        await reader.cancel();
        break;
      }
    }
    const readableSize = Math.min(size, MAX_HTML_BYTES);
    const bytes = new Uint8Array(readableSize);
    let offset = 0;
    for (const chunk of chunks) {
      if (offset >= readableSize) break;
      const slice = chunk.slice(0, readableSize - offset);
      bytes.set(slice, offset);
      offset += slice.byteLength;
    }
    const html = new TextDecoder().decode(bytes);
    diagnostics.responseSize = readableSize;
    diagnostics.receivedHtml = Boolean(html.trim());
    diagnostics.finalUrl = url.toString();
    return {
      status: "OK",
      html,
      diagnostics,
      warning: diagnostics.truncated
        ? "Only the first 1 MB of this webpage was analyzed"
        : undefined,
    };
  }

  throw new Error("Unreachable redirect state");
}
