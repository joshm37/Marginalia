import { NextResponse } from "next/server";
import {
  AppError,
  ConflictError,
  NotFoundError,
  RateLimitError,
} from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { DuplicateSourceError } from "@/lib/services/source-service";
import { sourceDto } from "@/lib/api/dto";

export function apiError(error: unknown, request?: Request) {
  const requestId = request?.headers.get("x-vercel-id") ?? crypto.randomUUID();
  const route = request ? new URL(request.url).pathname : "unknown";
  const databaseCode =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : undefined;
  const normalized =
    error instanceof AppError
      ? error
      : databaseCode === "P2002"
        ? new ConflictError("A record with these details already exists")
        : databaseCode === "P2025"
          ? new NotFoundError()
          : databaseCode === "P2003"
            ? new ConflictError("This record is still referenced by other data")
            : new AppError(
                "An unexpected server error occurred",
                500,
                "INTERNAL_ERROR",
              );

  logger[normalized.status >= 500 ? "error" : "warn"]("api_request_failed", {
    requestId,
    route,
    method: request?.method,
    status: normalized.status,
    code: normalized.code,
    errorName: error instanceof Error ? error.name : typeof error,
    errorMessage:
      normalized.status < 500
        ? error instanceof Error
          ? error.message
          : String(error)
        : "Internal error details redacted",
  });

  const body: Record<string, unknown> = {
    error: normalized.message,
    code: normalized.code,
    requestId,
  };
  if (normalized.details && normalized.status < 500)
    body.details = normalized.details;
  if (error instanceof DuplicateSourceError)
    body.existingSource = sourceDto(
      error.existingSource as Parameters<typeof sourceDto>[0],
    );
  const headers = new Headers({ "x-request-id": requestId });
  if (normalized instanceof RateLimitError)
    headers.set("retry-after", String(normalized.retryAfter));
  return NextResponse.json(body, { status: normalized.status, headers });
}
