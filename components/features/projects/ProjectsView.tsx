"use client";

import { Archive, Download, Filter, MoreHorizontal, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Annotation, Project, Source } from "@/lib/types";

export function ProjectsView({
  projects,
  sources,
  annotations,
  onAdd,
  onProject,
  onState,
  onRequestDelete,
  onExport,
}: {
  projects: Project[];
  sources: Source[];
  annotations: Annotation[];
  onAdd: () => void;
  onProject: (project: Project) => void;
  onState: (
    project: Project,
    action: "unarchive" | "archive",
  ) => void | Promise<void>;
  onRequestDelete: (project: Project) => void;
  onExport: (project: Project) => void;
}) {
  const [showArchived, setShowArchived] = useState(false);
  const [projectQuery, setProjectQuery] = useState("");
  const active = projects.filter(
    (project) => !project.deletedAt && project.isActive,
  );
  const archived = projects.filter(
    (project) => !project.deletedAt && !project.isActive,
  );
  const availableProjects = showArchived ? [...active, ...archived] : active;
  const visibleProjects = availableProjects.filter((project) =>
    [project.name, project.description]
      .join(" ")
      .toLowerCase()
      .includes(projectQuery.trim().toLowerCase()),
  );
  return (
    <>
      <div className="page-title">
        <div>
          <div className="kicker">Workspaces</div>
          <h2>Projects</h2>
          <p>Organize sources and excerpts into focused research spaces.</p>
        </div>
        <button className="btn primary" onClick={onAdd}>
          <Plus size={16} /> New project
        </button>
      </div>
      <div className="project-tabs-row">
        <div className="project-total">
          {projectQuery
            ? `${visibleProjects.length} of ${availableProjects.length} projects`
            : showArchived
              ? `${availableProjects.length} projects shown`
              : `${active.length} active ${active.length === 1 ? "project" : "projects"}`}
        </div>
        <div className="project-quick-actions">
          <div className="project-search">
            <Search size={14} />
            <input
              value={projectQuery}
              onChange={(event) => setProjectQuery(event.target.value)}
              aria-label="Search projects"
            />
            {projectQuery && (
              <button
                aria-label="Clear project search"
                onClick={() => setProjectQuery("")}
              >
                <X size={13} />
              </button>
            )}
          </div>
          <ProjectFilter
            showArchived={showArchived}
            archivedCount={archived.length}
            onChange={setShowArchived}
          />
        </div>
      </div>
      <ProjectSection
        title=""
        description=""
        projects={visibleProjects}
        sources={sources}
        annotations={annotations}
        onProject={onProject}
        onState={onState}
        onRequestDelete={onRequestDelete}
        onExport={onExport}
        emptyMessage={
          projectQuery
            ? "No projects match your search."
            : archived.length
              ? "No active projects. Use the filter to show archived projects."
              : "No projects here yet."
        }
      />
    </>
  );
}

function ProjectSection({
  title,
  description,
  projects,
  sources,
  annotations,
  onProject,
  onState,
  onRequestDelete,
  onExport,
  emptyMessage = "No projects here yet.",
}: {
  title: string;
  description: string;
  projects: Project[];
  sources: Source[];
  annotations: Annotation[];
  onProject?: (project: Project) => void;
  onState: (
    project: Project,
    action: "unarchive" | "archive",
  ) => void | Promise<void>;
  onRequestDelete: (project: Project) => void;
  onExport: (project: Project) => void;
  emptyMessage?: string;
}) {
  return (
    <section className="project-section">
      {(title || description) && (
        <div className="section-list-heading">
          <div>
            {title && <h3>{title}</h3>}
            {description && <p>{description}</p>}
          </div>
        </div>
      )}
      {projects.length ? (
        <div className="project-library-grid">
          {projects.map((project) => (
            <div
              className="card project-library-card"
              key={project.id}
              role="button"
              tabIndex={0}
              onClick={() => onProject?.(project)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onProject?.(project);
                }
              }}
            >
              <div className="project-library-copy">
                <div className="kicker">
                  {project.isActive ? "Active project" : "Archived project"}
                </div>
                <h3>{project.name}</h3>
                <p>{project.description || "Research workspace"}</p>
                <div className="project-library-counts">
                  <span className="pill green">
                    {
                      sources.filter((source) =>
                        source.projects.includes(project.id),
                      ).length
                    }{" "}
                    sources
                  </span>
                  <span className="pill">
                    {
                      annotations.filter((annotation) =>
                        annotation.projects.includes(project.id),
                      ).length
                    }{" "}
                    excerpts
                  </span>
                </div>
              </div>
              <div className="project-card-actions">
                <ProjectMenu
                  project={project}
                  onState={onState}
                  onRequestDelete={onRequestDelete}
                  onExport={onExport}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="project-section-empty">{emptyMessage}</div>
      )}
    </section>
  );
}

function ProjectFilter({
  showArchived,
  archivedCount,
  onChange,
}: {
  showArchived: boolean;
  archivedCount: number;
  onChange: (value: boolean) => void;
}) {
  const filterRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    function close(event: PointerEvent) {
      if (!filterRef.current?.contains(event.target as Node))
        filterRef.current?.removeAttribute("open");
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") filterRef.current?.removeAttribute("open");
    }
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  return (
    <details
      className="project-filter"
      ref={filterRef}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary aria-label="Filter projects" title="Filter projects">
        <Filter size={15} />
        {showArchived && <span />}
      </summary>
      <div>
        <div className="project-filter-heading">Filter projects</div>
        <label>
          <span>
            <strong>Show archived</strong>
            <small>{archivedCount} archived</small>
          </span>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => onChange(event.target.checked)}
          />
          <i className={showArchived ? "on" : ""}>
            <b />
          </i>
        </label>
      </div>
    </details>
  );
}

export function ProjectMenu({
  project,
  onState,
  onRequestDelete,
  onExport,
}: {
  project: Project;
  onState: (
    project: Project,
    action: "unarchive" | "archive",
  ) => void | Promise<void>;
  onRequestDelete: (project: Project) => void;
  onExport: (project: Project) => void;
}) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    function close(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node))
        menuRef.current?.removeAttribute("open");
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") menuRef.current?.removeAttribute("open");
    }
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  function act(action: () => void) {
    menuRef.current?.removeAttribute("open");
    action();
  }
  return (
    <details
      ref={menuRef}
      className="project-menu"
      onClick={(event) => event.stopPropagation()}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary aria-label={`Actions for ${project.name}`}>
        <MoreHorizontal size={17} />
      </summary>
      <div>
        <button onClick={() => act(() => onExport(project))}>
          <Download size={14} /> Export bibliography
        </button>
        <button
          onClick={() =>
            act(() =>
              onState(project, project.isActive ? "archive" : "unarchive"),
            )
          }
        >
          {project.isActive ? (
            <><Archive size={14} /> Archive</>
          ) : (
            <><RotateCcw size={14} /> Unarchive</>
          )}
        </button>
        {!project.isActive && (
          <button
            className="danger"
            onClick={() => act(() => onRequestDelete(project))}
          >
            <Trash2 size={14} /> Delete project
          </button>
        )}
      </div>
    </details>
  );
}

export function ArchivedProjectsView({
  projects,
  sources,
  annotations,
  onProject,
  onState,
  onRequestDelete,
  onExport,
}: {
  projects: Project[];
  sources: Source[];
  annotations: Annotation[];
  onProject: (project: Project) => void;
  onState: (
    project: Project,
    action: "unarchive" | "archive",
  ) => void | Promise<void>;
  onRequestDelete: (project: Project) => void;
  onExport: (project: Project) => void;
}) {
  return (
    <>
      <div className="page-title">
        <div>
          <div className="kicker">Manage</div>
          <h2>Archived projects</h2>
          <p>
            Projects hidden from your dashboard but preserved in your workspace.
          </p>
        </div>
      </div>
      <ProjectSection
        title="Archived"
        description={`${projects.length} archived ${projects.length === 1 ? "project" : "projects"}.`}
        projects={projects}
        sources={sources}
        annotations={annotations}
        onProject={onProject}
        onState={onState}
        onRequestDelete={onRequestDelete}
        onExport={onExport}
        emptyMessage="You have no archived projects."
      />
    </>
  );
}
