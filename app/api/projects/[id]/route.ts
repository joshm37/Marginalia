import { NextRequest, NextResponse } from "next/server";
import { projectDto } from "@/lib/api/dto";
import { apiError } from "@/lib/api/responses";
import { requireUser } from "@/lib/auth/require-user";
import { researchService } from "@/lib/services/research-service";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const body = await request.json();
    const action = String(body.action ?? "");
    const data =
      action === "unarchive"
        ? { isActive: true }
        : action === "archive"
          ? { isActive: false }
          : null;
    if (!data)
      return NextResponse.json(
        { error: "Invalid project action" },
        { status: 400 },
      );
    const row = await researchService.projects.updateState(user.id, id, data);
    return NextResponse.json(
      projectDto(row as Parameters<typeof projectDto>[0]),
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const deleted = await researchService.projects.deletePermanently(
      user.id,
      id,
    );
    return deleted
      ? new NextResponse(null, { status: 204 })
      : NextResponse.json(
          { error: "Only archived projects can be permanently deleted" },
          { status: 409 },
        );
  } catch (error) {
    return apiError(error);
  }
}
