import type { Instrumentation } from "next";
import { reportOperationalError } from "@/lib/observability/error-reporter";

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const digest =
    typeof error === "object" && error && "digest" in error
      ? String(error.digest)
      : undefined;
  await reportOperationalError({
    errorName: error instanceof Error ? error.name : typeof error,
    digest,
    route: context.routePath,
    method: request.method,
    routeType: context.routeType,
  });
};
