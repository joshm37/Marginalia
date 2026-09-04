import {
  checkDuplicate,
  getProjects,
  getTags,
  saveAnnotation,
  saveSource,
} from "./api-service.js";
import { normalizeUrl } from "./url-normalization.js";
import { enqueueRequest, processQueue, queueCount } from "./queue-service.js";

const SOURCES_KEY = "marginaliaSavedSources";
const THEME_KEY = "marginaliaTheme";
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

async function protectSessionStorage() {
  if (chrome.storage.local.setAccessLevel)
    await chrome.storage.local.setAccessLevel({
      accessLevel: "TRUSTED_CONTEXTS",
    });
}
chrome.runtime.onInstalled.addListener(async () => {
  await protectSessionStorage();
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "marginalia-capture-selection",
      title: "Save selection to Marginalia",
      contexts: ["selection"],
    });
  });
  chrome.alarms.create("marginalia-retry-queue", { periodInMinutes: 1 });
});
chrome.runtime.onStartup.addListener(protectSessionStorage);
protectSessionStorage();

async function sendQueued(item) {
  if (item.kind === "source") return saveSource(item.payload);
  if (item.kind === "excerpt") return saveAnnotation(item.payload);
  throw Object.assign(new Error("Unknown queued request"), { retryable: false });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "marginalia-retry-queue")
    processQueue(sendQueued).catch(() => undefined);
});

async function requestSelectionCapture(tab, selectionText) {
  if (!tab?.id) return;
  if (selectionText) {
    await chrome.storage.session.set({
      marginaliaPendingSelection: {
        selectedText: selectionText,
        url: tab.url,
        title: tab.title,
        pageNumber: new URL(tab.url || "https://invalid.local").hash.match(/page=(\d+)/i)?.[1] || "",
      },
    });
  } else {
    await chrome.tabs.sendMessage(tab.id, { type: "capture-current-selection" }).catch(() => undefined);
  }
  await chrome.action.openPopup().catch(() => undefined);
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "marginalia-capture-selection")
    requestSelectionCapture(tab, info.selectionText).catch(() => undefined);
});
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "capture-selection") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await requestSelectionCapture(tab);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "set-popup-theme") {
    if (message.theme === "dark" || message.theme === "light") {
      chrome.storage.local
        .set({ [THEME_KEY]: message.theme })
        .then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({ error: error.message }));
      return true;
    }
    sendResponse({ error: "Invalid theme" });
    return;
  }
  if (message.type === "get-popup-theme") {
    chrome.storage.local
      .get(THEME_KEY)
      .then((data) => sendResponse({ theme: data[THEME_KEY] || null }))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
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
      .catch(async (error) => {
        if (error.retryable) {
          await enqueueRequest("excerpt", message.annotation);
          sendResponse({ queued: true, message: "Saved to your retry queue. Marginalia will upload it when the connection returns." });
        } else sendResponse({ error: error.message, code: error.code });
      });
    return true;
  }
  if (message.type === "save-source") {
    saveSource(message.source)
      .then((source) => sendResponse({ source }))
      .catch(async (error) => {
        if (error.retryable) {
          await enqueueRequest("source", message.source);
          sendResponse({ queued: true, message: "Saved to your retry queue. Marginalia will upload it when the connection returns." });
        } else sendResponse({ error: error.message, code: error.code });
      });
    return true;
  }
  if (message.type === "queue-status") {
    queueCount()
      .then((count) => sendResponse({ count }))
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
