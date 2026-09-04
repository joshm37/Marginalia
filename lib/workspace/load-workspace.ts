import "server-only";
import { redirect } from "next/navigation";
import { UnauthorizedError } from "@/lib/api/errors";
import { excerptDto, projectDto, sourceDto } from "@/lib/api/dto";
import { requireUser } from "@/lib/auth/require-user";
import { researchService } from "@/lib/services/research-service";
import type { Annotation, Project, Source } from "@/lib/types";

export type WorkspaceData = {
  user: { id: string; email: string; name: string };
  sources: Source[];
  projects: Project[];
  excerpts: Annotation[];
};

export async function loadWorkspace(): Promise<WorkspaceData> {
  try {
    const user = await requireUser();
    const [sources, projects, excerpts] = await Promise.all([
      researchService.sources.list(user.id),
      researchService.projects.listAll(user.id),
      researchService.excerpts.list(user.id),
    ]);
    return {
      user: {
        id: user.id,
        email: user.email ?? "",
        name:
          user.user_metadata.full_name ??
          user.user_metadata.name ??
          user.email?.split("@")[0] ??
          "Researcher",
      },
      sources: sources.map((value) =>
        sourceDto(value as Parameters<typeof sourceDto>[0]),
      ) as Source[],
      projects: projects.map((value) =>
        projectDto(value as Parameters<typeof projectDto>[0]),
      ) as Project[],
      excerpts: excerpts.map((value) =>
        excerptDto(value as Parameters<typeof excerptDto>[0]),
      ) as Annotation[],
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login");
    throw error;
  }
}
