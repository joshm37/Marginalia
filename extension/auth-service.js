import { EXTENSION_CONFIG } from "./config.js";
const SESSION_KEY = "marginaliaSession";
let refreshPromise = null;

class AuthenticationError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "AuthenticationError";
    this.status = status;
    this.code = status === 401 || status === 400 ? "SESSION_EXPIRED" : "AUTH_UNAVAILABLE";
  }
}

async function request(path, options) {
  let response;
  try {
    response = await fetch(`${EXTENSION_CONFIG.apiBase}${path}`, options);
  } catch {
    throw new AuthenticationError("Marginalia is temporarily unreachable. Try again shortly.");
  }
  let data = {};
  try {
    data = await response.json();
  } catch {}
  if (!response.ok)
    throw new AuthenticationError(
      data.error || "Authentication request failed",
      response.status,
    );
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
  const session = await getSession();
  if (!session) return null;
  if ((session.expiresAt || 0) * 1000 > Date.now() + 60_000)
    return session.accessToken;

  const refresh = async () => {
    const latest = await getSession();
    if (!latest) return null;
    if ((latest.expiresAt || 0) * 1000 > Date.now() + 60_000)
      return latest.accessToken;
    try {
      const refreshed = await request("/api/extension/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: latest.refreshToken }),
      });
      await chrome.storage.local.set({ [SESSION_KEY]: refreshed });
      return refreshed.accessToken;
    } catch (error) {
      if (error.code === "SESSION_EXPIRED") await signOut();
      throw error;
    }
  };

  if (globalThis.navigator?.locks)
    return navigator.locks.request("marginalia-session-refresh", refresh);
  if (!refreshPromise) {
    refreshPromise = refresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}
