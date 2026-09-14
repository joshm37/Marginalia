type LogLevel = "info" | "warn" | "error";

const permittedFields = new Set([
  "requestId", "route", "method", "status", "code", "errorName",
  "errorMessage", "retryAfter", "analysisStatus", "httpStatus",
  "contentType", "responseSize", "redirectCount", "receivedHtml",
  "truncated", "routeType", "digest",
]);

function safeFields(fields: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([key, value]) => permittedFields.has(key) && ["string", "number", "boolean"].includes(typeof value))
      .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 300) : value]),
  );
}

function write(
  level: LogLevel,
  event: string,
  fields: Record<string, unknown>,
) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...safeFields(fields),
  });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

export const logger = {
  info: (event: string, fields: Record<string, unknown> = {}) =>
    write("info", event, fields),
  warn: (event: string, fields: Record<string, unknown> = {}) =>
    write("warn", event, fields),
  error: (event: string, fields: Record<string, unknown> = {}) =>
    write("error", event, fields),
};
