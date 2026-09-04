import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { RateLimitError } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function requestClientKey(request: Request) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "unknown";
  return digest(address);
}

export function sensitiveValueKey(value: string) {
  return digest(value.trim().toLowerCase());
}

export async function enforceRateLimit({
  namespace,
  identifier,
  limit,
  windowSeconds,
}: {
  namespace: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
}) {
  const key = `${namespace}:${identifier}`;
  const rows = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
    VALUES (${key}, 1, NOW() + (${windowSeconds} * INTERVAL '1 second'), NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= NOW() THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= NOW()
          THEN NOW() + (${windowSeconds} * INTERVAL '1 second')
        ELSE "RateLimitBucket"."resetAt"
      END,
      "updatedAt" = NOW()
    RETURNING "count", "resetAt"
  `;
  const bucket = rows[0];
  if (Math.random() < 0.01) {
    try {
      await prisma.rateLimitBucket.deleteMany({
        where: { resetAt: { lt: new Date() } },
      });
    } catch (error) {
      logger.warn("rate_limit_cleanup_failed", {
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }
  if (bucket && bucket.count > limit) {
    const retryAfter = Math.max(
      1,
      Math.ceil((bucket.resetAt.getTime() - Date.now()) / 1000),
    );
    throw new RateLimitError(retryAfter);
  }
}
