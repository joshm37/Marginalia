"use client";

import { BookOpen, Copy, ExternalLink, FileText, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Project, Source, SourceType } from "@/lib/types";
import { PaginationControls } from "@/components/ui/PaginationControls";

const sourceTypes: SourceType[] = ["Article", "Report", "Case", "Bill", "Book", "Website"];

export function SourcesView({
  sources,
  projects,
  activeType,
  onType,
  onSource,
  onDelete,
  onCopy,
  onEdit,
  onAdd,
}: {
  sources: Source[];
  projects: Project[];
  activeType: SourceType | "All";
  onType: (type: SourceType | "All") => void;
  onSource: (s: Source) => void;
  onDelete: (id: string) => void;
  onCopy: (s: Source) => void;
  onEdit: (source: Source) => void;
  onAdd: () => void;
}) {
  const [sourceQuery, setSourceQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("All");
  const [tagFilter, setTagFilter] = useState("All");
  const [sortBy, setSortBy] = useState("newest");
  const [pagination, setPagination] = useState({ scope: "", page: 1 });
  const pageSize = 20;
  const sourceTags = [
    ...new Set(sources.flatMap((source) => source.tags)),
  ].sort();
  const sourceProjects = projects
    .filter((project) =>
      sources.some((source) => source.projects.includes(project.id)),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );
  const visibleSources = useMemo(() => {
    const value = sourceQuery.trim().toLowerCase();
    return sources
      .filter(
        (source) =>
          (activeType === "All" || source.type === activeType) &&
          (projectFilter === "All" ||
            source.projects.includes(projectFilter)) &&
          (tagFilter === "All" || source.tags.includes(tagFilter)) &&
          (!value ||
            [
              source.title,
              source.authors,
              source.organization,
              source.description,
              source.bibliographyAnnotation,
              ...source.tags,
            ]
              .join(" ")
              .toLowerCase()
              .includes(value)),
      )
      .sort((a, b) => {
        if (sortBy === "oldest") return a.createdAt.localeCompare(b.createdAt);
        if (sortBy === "title") return a.title.localeCompare(b.title);
        if (sortBy === "author")
          return (a.authors || a.organization).localeCompare(
            b.authors || b.organization,
          );
        if (sortBy === "publication") return b.date.localeCompare(a.date);
        if (sortBy === "project")
          return (projectMap.get(a.projects[0])?.name || "").localeCompare(
            projectMap.get(b.projects[0])?.name || "",
          );
        if (sortBy === "tag")
          return (a.tags[0] || "").localeCompare(b.tags[0] || "");
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [
    activeType,
    projectFilter,
    projectMap,
    sortBy,
    sourceQuery,
    sources,
    tagFilter,
  ]);
  const hasSourceFilters = Boolean(
    sourceQuery || projectFilter !== "All" || tagFilter !== "All",
  );
  const pageCount = Math.max(1, Math.ceil(visibleSources.length / pageSize));
  const paginationScope = `${activeType}|${projectFilter}|${tagFilter}|${sourceQuery}`;
  const page =
    pagination.scope === paginationScope
      ? Math.min(pagination.page, pageCount)
      : 1;
  const paginatedSources = visibleSources.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  function clearSourceFilters() {
    setSourceQuery("");
    setProjectFilter("All");
    setTagFilter("All");
    onType("All");
  }
  return (
    <>
      <div className="page-title">
        <div>
          <div className="kicker">Research library</div>
          <h2>All sources</h2>
          <p>Review, organize, and cite everything you have collected.</p>
        </div>
        <button className="btn primary" onClick={onAdd}>
          <Plus size={16} /> New source
        </button>
      </div>
      <div className="toolbar">
        {(["All", ...sourceTypes] as const).map((t) => (
          <button
            className={`filter ${activeType === t ? "active" : ""}`}
            onClick={() => onType(t)}
            key={t}
          >
            {t}
            {t === "All" && <span>{sources.length}</span>}
          </button>
        ))}
      </div>
      <section className="card source-library-controls">
        <div className="source-library-search">
          <Search size={15} />
          <input
            value={sourceQuery}
            onChange={(event) => setSourceQuery(event.target.value)}
            aria-label="Search sources"
          />
        </div>
        <label>
          <span>Project</span>
          <select
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
          >
            <option>All</option>
            {sourceProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Tag</span>
          <select
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
          >
            <option>All</option>
            {sourceTags.map((tag) => (
              <option key={tag}>{tag}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
          >
            <option value="newest">Recently saved</option>
            <option value="oldest">Oldest saved</option>
            <option value="title">Title A–Z</option>
            <option value="author">Author A–Z</option>
            <option value="publication">Publication date</option>
            <option value="project">Project A–Z</option>
            <option value="tag">Tag A–Z</option>
          </select>
        </label>
        <div className="source-results-summary">
          <span>
            {visibleSources.length} of {sources.length} sources
          </span>
          {(hasSourceFilters || activeType !== "All") && (
            <button className="text-button" onClick={clearSourceFilters}>
              <X size={12} /> Clear
            </button>
          )}
        </div>
      </section>
      {visibleSources.length ? (
        paginatedSources.map((s) => (
          <div className="card source-card" key={s.id}>
            <button className="source-card-main" onClick={() => onSource(s)}>
              <span className="source-type-icon">
                <FileText size={18} />
              </span>
              <span>
                <span className="source-kind">{s.type}</span>
                <h3>{s.title}</h3>
                <span className="source-meta">
                  {s.authors} · {s.organization} · {s.date}
                </span>
                <span className="desc">{s.description}</span>
                {s.bibliographyAnnotation && (
                  <span className="source-bibliography-preview">
                    <BookOpen size={12} />
                    {s.bibliographyAnnotation}
                  </span>
                )}
                {s.tags.map((t) => (
                  <span className="pill" key={t}>
                    #{t}
                  </span>
                ))}
              </span>
            </button>
            <div className="source-actions">
              <button
                className="icon-btn"
                title="Edit source"
                onClick={() => onEdit(s)}
              >
                <Pencil size={15} />
              </button>
              <button
                className="icon-btn"
                title="Copy APA citation"
                onClick={() => onCopy(s)}
              >
                <Copy size={15} />
              </button>
              <a
                className="icon-btn"
                href={s.url}
                target="_blank"
                rel="noreferrer"
                title="Open original"
              >
                <ExternalLink size={15} />
              </a>
              <button
                className="icon-btn danger"
                title="Delete"
                onClick={() => onDelete(s.id)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))
      ) : (
        <div className="card empty">
          <Search size={24} />
          <h3>No sources found</h3>
          <p>Try a different search, type, project, or tag.</p>
          {(hasSourceFilters || activeType !== "All") && (
            <button className="btn" onClick={clearSourceFilters}>
              Clear filters
            </button>
          )}
          {!sources.length && (
            <button className="btn primary" onClick={onAdd}>
              <Plus size={15} /> New source
            </button>
          )}
        </div>
      )}
      {visibleSources.length > pageSize && (
        <PaginationControls
          page={page}
          pageCount={pageCount}
          itemLabel="sources"
          onPage={(nextPage) =>
            setPagination({ scope: paginationScope, page: nextPage })
          }
        />
      )}
    </>
  );
}
