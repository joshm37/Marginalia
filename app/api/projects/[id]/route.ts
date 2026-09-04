import { NextRequest, NextResponse } from "next/server";
import { projectDto } from "@/lib/api/dto";
import { apiError } from "@/lib/api/responses";
import { requireUser } from "@/lib/auth/require-user";
import { researchService } from "@/lib/services/research-service";
import { projectActionSchema } from "@/lib/api/schemas";
import { parseJson, parseResourceId } from "@/lib/api/validation";
import { NotFoundError } from "@/lib/api/errors";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const id = parseResourceId((await context.params).id);
    const body = await parseJson(request, projectActionSchema);
    const action = body.action;
    const data =
      action === "unarchive" ? { isActive: true } : { isActive: false };
    const row = await researchService.projects.updateState(user.id, id, data);
    return NextResponse.json(
      projectDto(row as Parameters<typeof projectDto>[0]),
    );
  } catch (error) {
    return apiError(error, request);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const id = parseResourceId((await context.params).id);
    const deleted = await researchService.projects.deletePermanently(
      user.id,
      id,
    );
    if (!deleted) throw new NotFoundError("Archived project not found");
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError(error, request);
  }
}
