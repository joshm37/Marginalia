import { WorkspaceRoute } from "@/components/workspace/WorkspaceRoute";

export default async function SourcePage({
  params,
}: {
  params: Promise<{ sourceId: string }>;
}) {
  const { sourceId } = await params;
  return <WorkspaceRoute view="Source" sourceId={sourceId} />;
}
