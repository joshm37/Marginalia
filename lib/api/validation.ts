import { z } from "zod";
import { ValidationError } from "@/lib/api/errors";

export async function parseJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.output<T>> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(
      result.error.issues[0]?.message ?? "Invalid request",
      result.error.flatten(),
    );
  }
  return result.data;
}

export function parseQuery<T extends z.ZodType>(
  url: URL,
  schema: T,
): z.output<T> {
  const result = schema.safeParse(Object.fromEntries(url.searchParams));
  if (!result.success) {
    throw new ValidationError(
      result.error.issues[0]?.message ?? "Invalid query",
      result.error.flatten(),
    );
  }
  return result.data;
}

export function parseResourceId(value: string) {
  const result = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/)
    .safeParse(value);
  if (!result.success) throw new ValidationError("Resource ID is invalid");
  return result.data;
}
