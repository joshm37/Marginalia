"use client";

import { ArrowRight, BookmarkPlus, FileText, FolderOpen, Highlighter, Layers3, Plus } from "lucide-react";
import type { Annotation, Project, Source } from "@/lib/types";
import type { WorkspaceView } from "@/components/workspace/types";

export function Dashboard({
  userName,
  sources,
  projects,
  annotations,
  onSource,
  onProject,
  onAddProject,
  onNavigate,
}: {
  userName: string;
  sources: Source[];
  projects: Project[];
  annotations: Annotation[];
  onSource: (s: Source) => void;
  onProject: (project: Project) => void;
  onAddProject: () => void;
  onNavigate: (view: WorkspaceView) => void;
}) {
  const activeProjects = projects.filter(
    (project) => project.isActive && !project.deletedAt,
  );
  return (
    <>
      <div className="page-title hero-title">
        <div>
          <div className="eyebrow">
            <span className="status-dot" /> Your research workspace
          </div>
          <h2>Welcome back{userName ? `, ${userName.split(" ")[0]}` : ""}.</h2>
          <p>
            Pick up where you left off, or capture something new for your
            research.
          </p>
        </div>
        <button className="btn primary" onClick={onAddProject}>
          <Plus size={16} /> Create project
        </button>
      </div>
      <div className="dashboard-priority">
        <section className="card featured-projects">
          <div className="card-header">
            <div className="section-heading">
              <span className="section-heading-icon">
                <Layers3 size={15} />
              </span>
              <div>
                <h3>Active projects</h3>
                <p>
                  Your research in progress · {activeProjects.length} active
                </p>
              </div>
            </div>
            <button
              className="text-button"
              onClick={() => onNavigate("Projects")}
            >
              View all projects <ArrowRight size={14} />
            </button>
          </div>
          <div className="project-showcase">
            {activeProjects.map((p, index) => (
              <button
                className="project project-feature"
                key={p.id}
                onClick={() => onProject(p)}
              >
                <span className={`project-mark mark-${index + 1}`}>
                  <FolderOpen size={17} />
                </span>
                <span>
                  <strong>{p.name}</strong>
                  <small>{p.description || "Research workspace"}</small>
                  <span className="project-counts">
                    {sources.filter((s) => s.projects.includes(p.id)).length}{" "}
                    sources ·{" "}
                    {
                      annotations.filter((a) => a.projects.includes(p.id))
                        .length
                    }{" "}
                    annotations
                  </span>
                </span>
                <ArrowRight size={14} />
              </button>
            ))}
            {!activeProjects.length && (
              <div className="project-showcase-empty">
                No active projects. Mark one active from the Projects page.
              </div>
            )}
          </div>
        </section>
        <div className="dashboard-secondary">
          <section className="card">
            <div className="card-header">
              <div className="section-heading">
                <span className="section-heading-icon">
                  <BookmarkPlus size={15} />
                </span>
                <div>
                  <h3>Recently saved</h3>
                  <p>Your latest additions</p>
                </div>
              </div>
              <button
                className="text-button"
                onClick={() => onNavigate("Sources")}
              >
                View library <ArrowRight size={14} />
              </button>
            </div>
            {sources.slice(0, 4).map((s) => (
              <button
                className="source-row"
                key={s.id}
                onClick={() => onSource(s)}
              >
                <div className="source-type-icon">
                  <FileText size={17} />
                </div>
                <div>
                  <div className="source-title">{s.title}</div>
                  <div className="source-meta">
                    {s.organization || s.authors} · {s.date}
                  </div>
                  <div>
                    {s.tags.slice(0, 2).map((t) => (
                      <span className="pill" key={t}>
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="source-kind">{s.type}</span>
              </button>
            ))}
          </section>
          <section className="card">
            <div className="card-header">
              <div className="section-heading">
                <span className="section-heading-icon">
                  <Highlighter size={15} />
                </span>
                <div>
                  <h3>Recent excerpts</h3>
                  <p>Your latest evidence and notes</p>
                </div>
              </div>
              <button
                className="text-button"
                onClick={() => onNavigate("Annotations")}
              >
                View excerpts <ArrowRight size={14} />
              </button>
            </div>
            {annotations.slice(0, 4).map((a) => (
              <div className="annotation dashboard-annotation" key={a.id}>
                <div className="quote">{a.selectedText}</div>
                <div className="note">
                  {a.note || "No note added"} ·{" "}
                  {sources.find((s) => s.id === a.sourceId)?.title}
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}

