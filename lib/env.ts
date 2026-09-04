import { z } from "zod";
import { ConfigurationError } from "@/lib/api/errors";

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().url(),
});

let cached: z.infer<typeof serverSchema> | undefined;

export function serverEnv() {
  if (cached) return cached;
  const result = serverSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
  });
  if (!result.success) {
    const names = result.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new ConfigurationError(
      `Missing or invalid server configuration: ${names}`,
    );
  }
  cached = result.data;
  return cached;
}

export function publicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new ConfigurationError(
      "Supabase is not configured for this deployment",
    );
  }
  return { url, publishableKey };
}
