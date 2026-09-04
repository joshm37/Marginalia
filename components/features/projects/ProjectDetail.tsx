"use client";

import { ArrowLeft, ArrowRight, BookmarkPlus, FileText, Library } from "lucide-react";
import type { Annotation, Project, Source } from "@/lib/types";
import { ProjectMenu } from "@/components/features/projects/ProjectsView";

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
          sources.map((source) => {
            const sourceAnnotations = annotations.filter(
              (annotation) => annotation.sourceId === source.id,
            ).length;
            return (
              <button
                className="card project-source-card"
                key={source.id}
                onClick={() => onSource(source)}
              >
                <span className="source-type-icon">
                  <FileText size={18} />
                </span>
                <span className="project-source-copy">
                  <span className="source-kind">{source.type}</span>
                  <strong>{source.title}</strong>
                  <small>
                    {[source.authors, source.organization, source.date]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                  <span className="project-source-tags">
                    {source.tags.slice(0, 4).map((tag) => (
                      <span className="pill" key={tag}>
                        #{tag}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="project-source-annotation-count">
                  {sourceAnnotations} excerpts
                </span>
                <ArrowRight size={16} />
              </button>
            );
          })
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
