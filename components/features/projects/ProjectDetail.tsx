"use client";

import { ArrowLeft, BookmarkPlus, Library } from "lucide-react";
import type { Annotation, Project, Source } from "@/lib/types";
import { ProjectMenu } from "@/components/features/projects/ProjectsView";
import { SourceTile } from "@/components/features/sources/SourceTile";

export function ProjectDetail({
  project,
  sources,
  annotations,
  onBack,
  onSource,
  onAddSource,
  onState,
  onRequestDelete,
  onExport,
  onEditSource,
  onCopySource,
  onDeleteSource,
}: {
  project: Project;
  sources: Source[];
  annotations: Annotation[];
  onBack: () => void;
  onSource: (source: Source) => void;
  onAddSource: () => void;
  onState: (
    project: Project,
    action: "unarchive" | "archive",
  ) => void | Promise<void>;
  onRequestDelete: (project: Project) => void;
  onExport: (project: Project) => void;
  onEditSource: (source: Source) => void;
  onCopySource: (source: Source) => void;
  onDeleteSource: (source: Source) => void;
}) {
  const annotationCount = annotations.filter((annotation) =>
    annotation.projects.includes(project.id),
  ).length;
  return (
    <>
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={15} /> Back
      </button>
      <div className="page-title detail-page-title project-detail-title">
        <div className="detail-heading-copy">
          <div className="kicker">Project</div>
          <h2>{project.name}</h2>
          <p>{project.description || "Your collected research sources."}</p>
          <div className="project-detail-counts">
            <span>{sources.length} sources</span>
            <span>{annotationCount} excerpts</span>
          </div>
        </div>
        <div className="detail-page-actions project-detail-actions">
          <button className="btn primary" onClick={onAddSource}>
            <BookmarkPlus size={16} /> Save a source
          </button>
          <ProjectMenu
            project={project}
            onState={onState}
            onRequestDelete={onRequestDelete}
            onExport={onExport}
          />
        </div>
      </div>
      <section className="project-source-list">
        <div className="section-list-heading">
          <div>
            <h3>Sources</h3>
            <p>Everything saved to this project.</p>
          </div>
        </div>
        {sources.length ? (
          sources.map((source) => (
            <SourceTile
              key={source.id}
              source={source}
              onOpen={onSource}
              onEdit={onEditSource}
              onCopy={onCopySource}
              onDelete={onDeleteSource}
            />
          ))
        ) : (
          <div className="card empty">
            <Library size={24} />
            <h3>No sources in this project yet</h3>
            <p>Save a source and assign it to {project.name}.</p>
            <button className="btn primary" onClick={onAddSource}>
              <BookmarkPlus size={15} /> Save a source
            </button>
          </div>
        )}
      </section>
    </>
  );
}
