import type { CitationStyle } from "@/lib/citations/types";
import type { Source } from "@/lib/types";

export const SESSION_EXPIRED_EVENT = "marginalia-session-expired";

export async function readJsonResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json"))
    throw new Error(
      `The server returned an unexpected ${response.status} response. Check the development server for the underlying error.`,
    );
  const data = await response.json();
  if (response.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    throw new Error("Your session expired. Redirecting to sign in…");
  }
  if (response.status === 429) {
    const seconds = response.headers.get("retry-after");
    throw new Error(
      seconds
        ? `Too many requests. Try again in ${seconds} seconds.`
        : (data.error ?? "Too many requests. Please try again shortly."),
    );
  }
  return data;
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export async function requestCitation(source: Source, style: CitationStyle) {
  const result = await postJson<{ citation: string }>("/api/citations/format", {
    source,
    style,
  });
  return result.citation;
}
