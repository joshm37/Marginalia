import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    serverEnv();
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", timestamp: new Date().toISOString() },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return apiError(error, request);
  }
}
