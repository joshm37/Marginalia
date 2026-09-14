"use client";

import { CircleAlert, Plus, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Project, Source, SourceType } from "@/lib/types";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { readJsonResponse } from "@/lib/client/api";
import { SourceTile } from "@/components/features/sources/SourceTile";

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
  const [reviewOnly, setReviewOnly] = useState(false);
  const [pagination, setPagination] = useState({ scope: "", page: 1 });
  const [serverPage, setServerPage] = useState<{ items: Source[]; total: number; pageCount: number } | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const [pageError, setPageError] = useState("");
  const [retry, setRetry] = useState(0);
  const pageSize = 20;
  const sourceTags = [
    ...new Set(sources.flatMap((source) => source.tags)),
  ].sort();
  const sourceProjects = projects
    .filter((project) =>
      sources.some((source) => source.projects.includes(project.id)),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const hasSourceFilters = Boolean(
    sourceQuery || projectFilter !== "All" || tagFilter !== "All" || reviewOnly,
  );
  const paginationScope = `${activeType}|${projectFilter}|${tagFilter}|${sourceQuery}|${reviewOnly}|${sortBy}`;
  const page = pagination.scope === paginationScope ? pagination.page : 1;
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingPage(true);
      setPageError("");
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort: sortBy });
      if (sourceQuery.trim()) params.set("q", sourceQuery.trim());
      if (activeType !== "All") params.set("type", activeType);
      if (projectFilter !== "All") params.set("projectId", projectFilter);
      if (tagFilter !== "All") params.set("tag", tagFilter);
      if (reviewOnly) params.set("reviewOnly", "true");
      try {
        const response = await fetch(`/api/sources?${params}`, { cache: "no-store", signal: controller.signal });
        const data = await readJsonResponse(response) as { items: Source[]; total: number; pageCount: number; error?: string };
        if (!response.ok) throw new Error(data.error || "Could not load sources");
        setServerPage(data);
      } catch (error) {
        if (!controller.signal.aborted) setPageError(error instanceof Error ? error.message : "Could not load sources");
      } finally {
        if (!controller.signal.aborted) setLoadingPage(false);
      }
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [activeType, page, projectFilter, retry, sortBy, sourceQuery, sources, tagFilter, reviewOnly]);
  const paginatedSources = serverPage?.items ?? sources.slice(0, pageSize);
  const totalSources = serverPage?.total ?? sources.length;
  const pageCount = Math.max(1, serverPage?.pageCount ?? Math.ceil(sources.length / pageSize));
  const showInitialLoading = loadingPage && !serverPage && !sources.length;
  function clearSourceFilters() {
    setSourceQuery("");
    setProjectFilter("All");
    setTagFilter("All");
    setReviewOnly(false);
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
        <button
          className={`filter review-filter ${reviewOnly ? "active" : ""}`}
          aria-pressed={reviewOnly}
          onClick={() => setReviewOnly((value) => !value)}
        >
          <CircleAlert size={14} /> Needs review
          <span>{sources.filter((source) => source.metadataNeedsReview).length}</span>
        </button>
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
            {totalSources} source{totalSources === 1 ? "" : "s"}
          </span>
          {(hasSourceFilters || activeType !== "All") && (
            <button className="text-button" onClick={clearSourceFilters}>
              <X size={12} /> Clear
            </button>
          )}
        </div>
      </section>
      {pageError && <div className="analysis-error collection-error" role="alert">{pageError} <button className="text-button" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>}
      {showInitialLoading && <div className="collection-skeleton" role="status" aria-label="Loading sources"><span/><span/><span/></div>}
      {!showInitialLoading && (paginatedSources.length ? (
        paginatedSources.map((source) => (
          <SourceTile
            key={source.id}
            source={source}
            onOpen={onSource}
            onEdit={onEdit}
            onCopy={onCopy}
            onDelete={(item) => onDelete(item.id)}
          />
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
      ))}
      {pageCount > 1 && (
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
