import { notFound } from "next/navigation";
import { LocalPdfReader } from "@/components/features/pdf-reader/LocalPdfReader";
import { loadWorkspace } from "@/lib/workspace/load-workspace";

export default async function LocalPdfReaderPage({
  params,
}: {
  params: Promise<{ sourceId: string }>;
}) {
  const { sourceId } = await params;
  const workspace = await loadWorkspace();
  const source = workspace.sources.find((item) => item.id === sourceId);
  if (!source || source.storageMode !== "LOCAL" || !source.localFile) notFound();
  return (
    <LocalPdfReader
      source={source}
      initialExcerpts={workspace.excerpts.filter((item) => item.sourceId === source.id)}
      projects={workspace.projects.filter((project) => !project.deletedAt)}
    />
  );
}
