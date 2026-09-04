import { WorkspaceRoute } from "@/components/workspace/WorkspaceRoute";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <WorkspaceRoute view="Project" projectId={projectId} />;
}
