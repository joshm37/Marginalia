import path from "node:path";
import { defineConfig } from "vitest/config";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (testDatabaseUrl) {
  const hostname = new URL(testDatabaseUrl).hostname;
  if (hostname.includes("supabase")) {
    throw new Error(
      "Integration tests refuse to run against Supabase. Use a disposable PostgreSQL database.",
    );
  }
  process.env.DATABASE_URL = testDatabaseUrl;
} else {
  process.env.DATABASE_URL =
    "postgresql://unused:unused@127.0.0.1:1/marginalia_test";
}

export default defineConfig({
  resolve: { alias: { "@": path.resolve(process.cwd()) } },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    sequence: { concurrent: false },
  },
});
