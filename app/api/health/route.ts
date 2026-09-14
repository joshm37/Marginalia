import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    serverEnv();
    await prisma.$queryRaw`SELECT 1`;
    const build =
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
      process.env.npm_package_version ??
      "development";
    return NextResponse.json(
      { status: "ok", build, timestamp: new Date().toISOString() },
      {
        headers: {
          "cache-control": "no-store",
          "x-marginalia-build": build,
        },
      },
    );
  } catch (error) {
    return apiError(error, request);
  }
}
