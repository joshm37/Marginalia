import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { projectDto } from "@/lib/api/dto";
import { apiError } from "@/lib/api/responses";
import { researchService } from "@/lib/services/research-service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const rows = await researchService.projects.list(user.id);
    return NextResponse.json(
      rows.map((row) => projectDto(row as Parameters<typeof projectDto>[0])),
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json();
    const row = await researchService.projects.create(user.id, {
      name: String(body.name ?? "").trim(),
      description: body.description ? String(body.description) : undefined,
    });
    return NextResponse.json(
      projectDto(row as Parameters<typeof projectDto>[0]),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
