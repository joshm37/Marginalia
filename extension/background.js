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
  await chrome.contextMenus.removeAll();
  await chrome.contextMenus.create({
    id: "marginalia-capture-selection",
    title: "Save selection to Marginalia",
    contexts: ["selection"],
  });
  await chrome.alarms.create("marginalia-retry-queue", { periodInMinutes: 1 });
});
chrome.runtime.onStartup.addListener(protectSessionStorage);
protectSessionStorage();

async function sendQueued(item) {
  if (item.kind === "source") return saveSource(item.payload);
  if (item.kind === "excerpt") return saveAnnotation(item.payload);
  throw Object.assign(new Error("Unknown queued request"), { retryable: false });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "marginalia-retry-queue") return;
  try {
    await processQueue(sendQueued);
  } catch {}
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
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "capture-current-selection" });
    } catch {}
  }
  try {
    await chrome.action.openPopup();
  } catch {}
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "marginalia-capture-selection") return;
  try {
    await requestSelectionCapture(tab, info.selectionText);
  } catch {}
});
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "capture-selection") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await requestSelectionCapture(tab);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === "set-popup-theme") {
        if (message.theme !== "dark" && message.theme !== "light") {
          sendResponse({ error: "Invalid theme" });
          return;
        }
        await chrome.storage.local.set({ [THEME_KEY]: message.theme });
        sendResponse({ ok: true });
        return;
      }
      if (message.type === "get-popup-theme") {
        const data = await chrome.storage.local.get(THEME_KEY);
        sendResponse({ theme: data[THEME_KEY] || null });
        return;
      }
      if (message.type === "annotation-context") {
        const key = normalizeUrl(message.url);
        const data = await chrome.storage.local.get(SOURCES_KEY);
        const existing = data[SOURCES_KEY]?.[key];
        if (existing) {
          sendResponse({ context: existing });
          return;
        }
        const duplicate = await checkDuplicate({ url: message.url });
        if (!duplicate.duplicate || !duplicate.source) {
          sendResponse({ context: null });
          return;
        }
        const projects = await getProjects();
        const projectId = duplicate.source.projects?.[0];
        const project = projects.find((item) => item.id === projectId);
        if (!projectId) {
          sendResponse({ context: null });
          return;
        }
        const context = {
          sourceId: duplicate.source.id,
          sourceTitle: duplicate.source.title,
          projectId,
          projectName: project?.name || "Project",
        };
        await chrome.storage.local.set({
          [SOURCES_KEY]: { ...(data[SOURCES_KEY] || {}), [key]: context },
        });
        sendResponse({ context });
        return;
      }
      if (message.type === "save-annotation") {
        try {
          const annotation = await saveAnnotation(message.annotation);
          invalidateTagCache();
          sendResponse({ annotation });
        } catch (error) {
          if (error.retryable) {
            await enqueueRequest("excerpt", message.annotation);
            sendResponse({ queued: true, message: "Saved to your retry queue. Marginalia will upload it when the connection returns." });
          } else sendResponse({ error: error.message, code: error.code });
        }
        return;
      }
      if (message.type === "save-source") {
        try {
          const source = await saveSource(message.source);
          sendResponse({ source });
        } catch (error) {
          if (error.retryable) {
            await enqueueRequest("source", message.source);
            sendResponse({ queued: true, message: "Saved to your retry queue. Marginalia will upload it when the connection returns." });
          } else sendResponse({ error: error.message, code: error.code });
        }
        return;
      }
      if (message.type === "queue-status") {
        try { await processQueue(sendQueued); } catch {}
        sendResponse({ count: await queueCount() });
        return;
      }
      if (message.type === "list-tags") {
        sendResponse({ tags: await getCachedTags() });
        return;
      }
      if (message.type === "invalidate-tags") {
        invalidateTagCache();
        sendResponse({ ok: true });
      }
    } catch (error) {
      sendResponse({ error: error instanceof Error ? error.message : "Extension request failed" });
    }
  })();
  return true;
});
