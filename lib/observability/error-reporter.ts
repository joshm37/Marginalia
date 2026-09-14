import "server-only";
import { logger } from "@/lib/api/logger";

export type OperationalErrorEvent = {
  errorName: string;
  digest?: string;
  route: string;
  method: string;
  routeType: string;
};

export type ErrorReporter = (event: OperationalErrorEvent) => void | Promise<void>;

let reporter: ErrorReporter = (event) => {
  logger.error("unhandled_request_error", event);
};

/** Called from instrumentation.ts when a monitoring provider is selected. */
export function configureErrorReporter(next: ErrorReporter) {
  reporter = next;
}

export async function reportOperationalError(event: OperationalErrorEvent) {
  try {
    await reporter(event);
  } catch {
    // Monitoring must never turn an application error into a second failure.
  }
}
