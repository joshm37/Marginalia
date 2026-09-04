import { EXTENSION_CONFIG } from "./config.js";
const SESSION_KEY = "marginaliaSession";

async function request(path, options) {
  const response = await fetch(`${EXTENSION_CONFIG.apiBase}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.error || "Authentication request failed");
  return data;
}
export async function signIn(email, password) {
  const session = await request("/api/extension/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  await chrome.storage.local.set({ [SESSION_KEY]: session });
  return session;
}
export async function signOut() {
  await chrome.storage.local.remove(SESSION_KEY);
}
export async function getSession() {
  const stored = await chrome.storage.local.get(SESSION_KEY);
  return stored[SESSION_KEY] || null;
}
export async function getAccessToken() {
  let session = await getSession();
  if (!session) return null;
  if ((session.expiresAt || 0) * 1000 > Date.now() + 60_000)
    return session.accessToken;
  try {
    session = await request("/api/extension/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    await chrome.storage.local.set({ [SESSION_KEY]: session });
    return session.accessToken;
  } catch (error) {
    await signOut();
    error.code = "SESSION_EXPIRED";
    throw error;
  }
}
