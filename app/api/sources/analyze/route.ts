import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/responses";
import { requireUser } from "@/lib/auth/require-user";
import { analyzeWebpage } from "@/lib/metadata/analyze-webpage";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await requireUser(request);
    const body = await request.json();
    const url = String(body.url ?? "").trim();
    if (!url)
      return NextResponse.json(
        { error: "Enter a link to analyze" },
        { status: 400 },
      );
    return NextResponse.json(await analyzeWebpage(url));
  } catch (error) {
    return apiError(error);
  }
}
