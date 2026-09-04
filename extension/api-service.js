import { getAccessToken, signOut } from "./auth-service.js";
import { EXTENSION_CONFIG } from "./config.js";

export class ExtensionApiError extends Error {
  constructor(message, { status = 0, retryable = false, code = "REQUEST_FAILED", data } = {}) {
    super(message);
    this.name = "ExtensionApiError";
    this.status = status;
    this.retryable = retryable;
    this.code = code;
    this.data = data;
  }
}

async function api(path, options = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error("Sign in to Marginalia first");
  let response;
  try {
    response = await fetch(`${EXTENSION_CONFIG.apiBase}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  } catch {
    throw new ExtensionApiError("Marginalia is temporarily unreachable. Your work can be retried automatically.", {
      retryable: true,
      code: "NETWORK_ERROR",
    });
  }
  const data =
    response.status === 204 ? null : await response.json().catch(() => ({}));
  if (response.status === 401) {
    await signOut();
    throw new ExtensionApiError("Your session expired. Sign in to Marginalia again.", { status: 401, code: "SESSION_EXPIRED" });
  }
  if (response.status === 429) {
    const retryAfter = response.headers.get("retry-after");
    throw new Error(
      retryAfter
        ? `Too many requests. Try again in ${retryAfter} seconds.`
        : data?.error || "Too many requests. Please try again shortly.",
    );
  }
  if (!response.ok)
    throw new ExtensionApiError(data?.error || "Marginalia request failed", {
      status: response.status,
      retryable: response.status >= 500 || response.status === 408,
      data,
    });
  return data;
}
export const getProjects = () => api("/api/projects");
export const getTags = () => api("/api/tags");
export const createProject = (name) =>
  api("/api/projects", { method: "POST", body: JSON.stringify({ name }) });
export const saveSource = (source) =>
  api("/api/sources", { method: "POST", body: JSON.stringify(source) });
export const saveAnnotation = (annotation) =>
  api("/api/excerpts", { method: "POST", body: JSON.stringify(annotation) });
export const enrichDoi = (doi) =>
  api("/api/sources/enrich", {
    method: "POST",
    body: JSON.stringify({ doi }),
  });
export const checkDuplicate = ({ url, doi, canonicalUrl }) => {
  const query = new URLSearchParams({ url });
  if (doi) query.set("doi", doi);
  if (canonicalUrl) query.set("canonicalUrl", canonicalUrl);
  return api(`/api/sources/check-duplicate?${query}`);
};
export const appUrl = (path = "") => `${EXTENSION_CONFIG.appBase}${path}`;
