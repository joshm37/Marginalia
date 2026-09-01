import { getAccessToken } from "./auth-service.js";
const API_BASE = "http://localhost:3000";

async function api(path, options = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error("Sign in to Marginalia first");
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const data =
    response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "Marginalia request failed");
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
export const checkDuplicate = ({ url, doi, canonicalUrl }) => {
  const query = new URLSearchParams({ url });
  if (doi) query.set("doi", doi);
  if (canonicalUrl) query.set("canonicalUrl", canonicalUrl);
  return api(`/api/sources/check-duplicate?${query}`);
};
