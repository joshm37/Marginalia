import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { excerptDto, projectDto, sourceDto } from "@/lib/api/dto";
import { apiError } from "@/lib/api/responses";
import { researchService } from "@/lib/services/research-service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const [sources, projects, excerpts] = await Promise.all([
      researchService.sources.list(user.id),
      researchService.projects.listAll(user.id),
      researchService.excerpts.list(user.id),
    ]);
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name:
          user.user_metadata.full_name ??
          user.user_metadata.name ??
          user.email?.split("@")[0],
      },
      sources: sources.map((value) =>
        sourceDto(value as Parameters<typeof sourceDto>[0]),
      ),
      projects: projects.map((value) =>
        projectDto(value as Parameters<typeof projectDto>[0]),
      ),
      excerpts: excerpts.map((value) =>
        excerptDto(value as Parameters<typeof excerptDto>[0]),
      ),
    });
  } catch (error) {
    return apiError(error);
  }
}
