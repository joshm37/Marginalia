import { notFound } from "next/navigation";
import App from "@/components/App";
import { loadWorkspace } from "@/lib/workspace/load-workspace";
import type { WorkspaceView } from "@/components/workspace/types";

export async function WorkspaceRoute({
  view,
  projectId,
  sourceId,
  tag,
}: {
  view: WorkspaceView;
  projectId?: string;
  sourceId?: string;
  tag?: string;
}) {
  const data = await loadWorkspace();
  if (projectId && !data.projects.some((project) => project.id === projectId))
    notFound();
  if (sourceId && !data.sources.some((source) => source.id === sourceId))
    notFound();
  return (
    <App
      key={`${view}-${projectId ?? sourceId ?? "index"}`}
      initialData={data}
      initialRoute={{ view, projectId, sourceId, tag }}
    />
  );
}
