import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const protectedRoutes = [
  "app/api/account/route.ts",
  "app/api/account/export/route.ts",
  "app/api/citations/format/route.ts",
  "app/api/excerpts/[id]/route.ts",
  "app/api/excerpts/route.ts",
  "app/api/projects/[id]/route.ts",
  "app/api/projects/route.ts",
  "app/api/sources/[id]/route.ts",
  "app/api/sources/analyze/route.ts",
  "app/api/sources/check-duplicate/route.ts",
  "app/api/sources/enrich/route.ts",
  "app/api/sources/route.ts",
  "app/api/tags/route.ts",
  "app/api/workspace/route.ts",
];

describe("API authentication coverage", () => {
  it.each(protectedRoutes)("authenticates every handler in %s", (filename) => {
    const source = readFileSync(path.join(process.cwd(), filename), "utf8");
    const handlerCount = [...source.matchAll(/export async function (?:GET|POST|PATCH|DELETE|PUT)\s*\(/g)].length;
    const checks = [...source.matchAll(/await requireUser\(request\)/g)].length;
    expect(checks, `${filename} must authenticate each exported handler`).toBe(handlerCount);
  });
});
