import { WorkspaceRoute } from "@/components/workspace/WorkspaceRoute";

export default async function TagsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { tag } = await searchParams;
  return <WorkspaceRoute view="Tags" tag={tag} />;
}
