export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid request", details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 409, "CONFLICT", details);
  }
}

export class UnprocessableError extends AppError {
  constructor(message: string) {
    super(message, 422, "UNPROCESSABLE_CONTENT");
  }
}

export class UpstreamError extends AppError {
  constructor(message = "The remote website could not be reached") {
    super(message, 502, "UPSTREAM_ERROR");
  }
}

export class RateLimitError extends AppError {
  constructor(public readonly retryAfter: number) {
    super("Too many requests. Please try again shortly.", 429, "RATE_LIMITED");
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string) {
    super(message, 503, "CONFIGURATION_ERROR");
  }
}
