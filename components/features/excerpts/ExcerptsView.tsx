"use client";

import { Highlighter, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Annotation, Project, Source } from "@/lib/types";
import { AnnotationActions } from "@/components/ui/AnnotationActions";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { readJsonResponse } from "@/lib/client/api";

export function AnnotationsView({
  annotations,
  sources,
  projects,
  onSource,
  onAdd,
  onCopy,
  onEdit,
  onDelete,
}: {
  annotations: Annotation[];
  sources: Source[];
  projects: Project[];
  onSource: (source: Source) => void;
  onAdd: () => void;
  onCopy: (annotation: Annotation) => void;
  onEdit: (annotation: Annotation) => void;
  onDelete: (annotation: Annotation) => void;
}) {
  const [excerptQuery, setExcerptQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [projectFilter, setProjectFilter] = useState("All");
  const [tagFilter, setTagFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [sortBy, setSortBy] = useState("newest");
  const [pagination, setPagination] = useState({ scope: "", page: 1 });
  const [serverPage, setServerPage] = useState<{ items: Annotation[]; total: number; pageCount: number } | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const [pageError, setPageError] = useState("");
  const [retry, setRetry] = useState(0);
  const pageSize = 20;
  const sourceMap = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources],
  );
  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );
  const excerptSources = sources
    .filter((source) => annotations.some((item) => item.sourceId === source.id))
    .sort((a, b) => a.title.localeCompare(b.title));
  const excerptProjects = projects
    .filter((project) =>
      annotations.some((item) => item.projects.includes(project.id)),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const excerptTags = [
    ...new Set(annotations.flatMap((item) => item.tags)),
  ].sort();
  const excerptTypes = [
    ...new Set(annotations.map((item) => item.type)),
  ].sort();
  const hasFilters =
    excerptQuery ||
    sourceFilter !== "All" ||
    projectFilter !== "All" ||
    tagFilter !== "All" ||
    typeFilter !== "All";
  const paginationScope = `${excerptQuery}|${sourceFilter}|${projectFilter}|${tagFilter}|${typeFilter}|${sortBy}`;
  const page = pagination.scope === paginationScope ? pagination.page : 1;
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingPage(true); setPageError("");
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort: sortBy });
      if (excerptQuery.trim()) params.set("q", excerptQuery.trim());
      if (sourceFilter !== "All") params.set("sourceId", sourceFilter);
      if (projectFilter !== "All") params.set("projectId", projectFilter);
      if (tagFilter !== "All") params.set("tag", tagFilter);
      if (typeFilter !== "All") params.set("type", typeFilter);
      try {
        const response = await fetch(`/api/excerpts?${params}`, { cache: "no-store", signal: controller.signal });
        const data = await readJsonResponse(response) as { items: Annotation[]; total: number; pageCount: number; error?: string };
        if (!response.ok) throw new Error(data.error || "Could not load excerpts");
        setServerPage(data);
      } catch (error) {
        if (!controller.signal.aborted) setPageError(error instanceof Error ? error.message : "Could not load excerpts");
      } finally { if (!controller.signal.aborted) setLoadingPage(false); }
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [annotations, excerptQuery, page, projectFilter, retry, sortBy, sourceFilter, tagFilter, typeFilter]);
  const paginatedExcerpts = serverPage?.items ?? annotations.slice(0, pageSize);
  const totalExcerpts = serverPage?.total ?? annotations.length;
  const pageCount = Math.max(1, serverPage?.pageCount ?? Math.ceil(annotations.length / pageSize));
  const showInitialLoading = loadingPage && !serverPage && !annotations.length;
  function clearFilters() {
    setExcerptQuery("");
    setSourceFilter("All");
    setProjectFilter("All");
    setTagFilter("All");
    setTypeFilter("All");
  }
  return (
    <>
      <div className="page-title">
        <div>
          <div className="kicker">Evidence library</div>
          <h2>Excerpts</h2>
          <p>
            Passages, evidence, questions, and notes captured from your
            research.
          </p>
        </div>
        <button className="btn primary" onClick={onAdd}>
          <Plus size={16} /> New excerpt
        </button>
      </div>
      <section className="card excerpt-controls">
        <div className="excerpt-search">
          <Search size={15} />
          <input
            value={excerptQuery}
            onChange={(event) => setExcerptQuery(event.target.value)}
            aria-label="Search excerpts"
          />
        </div>
        <div className="excerpt-filter-grid">
          <label>
            <span>Source</span>
            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
            >
              <option>All</option>
              {excerptSources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Project</span>
            <select
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
            >
              <option>All</option>
              {excerptProjects.map((project) => (
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
              {excerptTags.map((tag) => (
                <option key={tag}>{tag}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Type</span>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option>All</option>
              {excerptTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Sort</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="source">Source A–Z</option>
              <option value="project">Project A–Z</option>
              <option value="tag">Tag A–Z</option>
              <option value="type">Type A–Z</option>
            </select>
          </label>
        </div>
        <div className="excerpt-results-summary">
          <span>
            {totalExcerpts} excerpt{totalExcerpts === 1 ? "" : "s"}
          </span>
          {hasFilters && (
            <button className="text-button" onClick={clearFilters}>
              <X size={12} /> Clear filters
            </button>
          )}
        </div>
      </section>
      {pageError && <div className="analysis-error collection-error" role="alert">{pageError} <button className="text-button" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>}
      {showInitialLoading && <div className="collection-skeleton" role="status" aria-label="Loading excerpts"><span/><span/><span/></div>}
      {!showInitialLoading && <div className="card excerpt-list">
        {paginatedExcerpts.map((a) => {
          const source = sourceMap.get(a.sourceId);
          const excerptProject = projectMap.get(a.projects[0]);
          return (
            <div className="annotation" key={a.id}>
              <div className="annotation-top">
                <div className="annotation-context">
                  <span className="annotation-type">
                    <Highlighter size={12} />
                    {a.type}
                  </span>
                  {source && (
                    <button
                      className="excerpt-source-link"
                      onClick={() => onSource(source)}
                    >
                      {source.title}
                    </button>
                  )}
                </div>
                <AnnotationActions
                  annotation={a}
                  onCopy={onCopy}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              </div>
              <div className="quote">{a.selectedText}</div>
              <div className="note">{a.note}</div>
              <div className="excerpt-footer">
                <div>
                  {a.tags.map((t) => (
                    <span className="pill" key={t}>
                      #{t}
                    </span>
                  ))}
                </div>
                <span>
                  {excerptProject?.name || "No project"} · {a.createdAt}
                </span>
              </div>
            </div>
          );
        })}
        {!paginatedExcerpts.length && (
          <div className="empty excerpt-empty">
            <Search size={23} />
            <h3>No excerpts found</h3>
            <p>Adjust your search or filters to see more evidence.</p>
            {hasFilters && (
              <button className="btn" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>}
      {pageCount > 1 && (
        <PaginationControls
          page={page}
          pageCount={pageCount}
          itemLabel="excerpts"
          onPage={(nextPage) =>
            setPagination({ scope: paginationScope, page: nextPage })
          }
        />
      )}
    </>
  );
}
