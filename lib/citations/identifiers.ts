export function normalizeDoi(doi?: string) {
  const value = doi
    ?.trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/^doi:\s*/, "");
  return value || undefined;
}

export function detectDoi(...values: unknown[]) {
  const pending = [...values];
  while (pending.length) {
    const value = pending.shift();
    if (Array.isArray(value)) {
      pending.push(...value);
      continue;
    }
    if (value && typeof value === "object") {
      pending.push(...Object.values(value));
      continue;
    }
    const match = String(value ?? "").match(/10\.\d{4,9}\/[\w.()/:+-]+/i);
    if (match) return normalizeDoi(match[0].replace(/[.,;]+$/, ""));
  }
  return undefined;
}
