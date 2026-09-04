import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { apiError } from "@/lib/api/responses";
import { researchService } from "@/lib/services/research-service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const tags = await researchService.tags.list(user.id);
    return NextResponse.json(
      tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        count: tag._count.sources + tag._count.excerpts,
      })),
    );
  } catch (error) {
    return apiError(error, request);
  }
}
