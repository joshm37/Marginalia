import {
  checkDuplicate,
  getProjects,
  getTags,
  saveAnnotation,
} from "./api-service.js";

const SOURCES_KEY = "marginaliaSavedSources";
const TAG_CACHE_TTL = 30_000;
let tagCache = { tags: [], expiresAt: 0 };

async function getCachedTags() {
  if (tagCache.expiresAt > Date.now()) return tagCache.tags;
  const tags = await getTags();
  tagCache = { tags, expiresAt: Date.now() + TAG_CACHE_TTL };
  return tags;
}

function invalidateTagCache() {
  tagCache.expiresAt = 0;
}

function normalizeUrl(rawUrl) {
  try {
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
    url.pathname = url.pathname.replace(/\/$/, "") || "/";
    url.searchParams.sort();
    return url.toString();
  } catch {
    return rawUrl;
  }
}

async function protectSessionStorage() {
  if (chrome.storage.local.setAccessLevel)
    await chrome.storage.local.setAccessLevel({
      accessLevel: "TRUSTED_CONTEXTS",
    });
}
chrome.runtime.onInstalled.addListener(protectSessionStorage);
chrome.runtime.onStartup.addListener(protectSessionStorage);
protectSessionStorage();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "annotation-context") {
    (async () => {
      const key = normalizeUrl(message.url),
        data = await chrome.storage.local.get(SOURCES_KEY),
        existing = data[SOURCES_KEY]?.[key];
      if (existing) return existing;
      const duplicate = await checkDuplicate({ url: message.url });
      if (!duplicate.duplicate || !duplicate.source) return null;
      const projects = await getProjects(),
        projectId = duplicate.source.projects?.[0],
        project = projects.find((item) => item.id === projectId);
      if (!projectId) return null;
      const context = {
        sourceId: duplicate.source.id,
        sourceTitle: duplicate.source.title,
        projectId,
        projectName: project?.name || "Project",
      };
      await chrome.storage.local.set({
        [SOURCES_KEY]: { ...(data[SOURCES_KEY] || {}), [key]: context },
      });
      return context;
    })()
      .then((context) => sendResponse({ context }))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
  if (message.type === "save-annotation") {
    saveAnnotation(message.annotation)
      .then((annotation) => {
        invalidateTagCache();
        sendResponse({ annotation });
      })
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
  if (message.type === "list-tags") {
    getCachedTags()
      .then((tags) => sendResponse({ tags }))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
  if (message.type === "invalidate-tags") {
    invalidateTagCache();
    sendResponse({ ok: true });
  }
});
