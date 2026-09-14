const QUEUE_KEY = "marginaliaRequestQueue";
const MAX_ATTEMPTS = 6;
let processing = null;

function fingerprint(kind, payload) {
  return `${kind}:${JSON.stringify(payload)}`;
}

export async function enqueueRequest(kind, payload) {
  const stored = await chrome.storage.local.get(QUEUE_KEY);
  const queue = stored[QUEUE_KEY] || [];
  const existing = queue.find((entry) => entry.fingerprint === fingerprint(kind, payload));
  if (existing) return existing;
  const item = {
    id: crypto.randomUUID(),
    kind,
    payload,
    attempts: 0,
    createdAt: Date.now(),
    nextAttemptAt: Date.now(),
    fingerprint: fingerprint(kind, payload),
  };
  await chrome.storage.local.set({ [QUEUE_KEY]: [...queue, item] });
  return item;
}

export async function processQueue(send) {
  if (processing) return processing;
  processing = processQueueOnce(send).finally(() => { processing = null; });
  return processing;
}

async function processQueueOnce(send) {
  const stored = await chrome.storage.local.get(QUEUE_KEY);
  const queue = stored[QUEUE_KEY] || [];
  const remaining = [];
  let completed = 0;
  for (const item of queue) {
    if (item.nextAttemptAt > Date.now()) {
      remaining.push(item);
      continue;
    }
    try {
      await send(item);
      completed += 1;
    } catch (error) {
      if (error?.code === "SESSION_EXPIRED") {
        remaining.push(item);
        continue;
      }
      const attempts = item.attempts + 1;
      if (error?.retryable !== false && attempts < MAX_ATTEMPTS) {
        remaining.push({
          ...item,
          attempts,
          nextAttemptAt: Date.now() + Math.min(30 * 60_000, 2 ** attempts * 15_000),
        });
      }
    }
  }
  await chrome.storage.local.set({ [QUEUE_KEY]: remaining });
  return { completed, remaining: remaining.length };
}

export async function queueCount() {
  const stored = await chrome.storage.local.get(QUEUE_KEY);
  return (stored[QUEUE_KEY] || []).length;
}
