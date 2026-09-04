"use client";

import { FileText, FolderOpen, Tag } from "lucide-react";
import type { ReactNode } from "react";
import type { Project, Source } from "@/lib/types";

export function UniversalSearchResults({
  results,
  onSource,
  onProject,
  onTag,
}: {
  results: { sources: Source[]; projects: Project[]; tags: string[] };
  onSource: (source: Source) => void;
  onProject: (project: Project) => void;
  onTag: (tag: string) => void;
}) {
  const hasResults =
    results.sources.length || results.projects.length || results.tags.length;
  return (
    <div className="universal-search-results">
      {results.projects.length > 0 && (
        <SearchResultGroup title="Projects">
          {results.projects.map((project) => (
            <button key={project.id} onClick={() => onProject(project)}>
              <FolderOpen size={15} />
              <span>
                <strong>{project.name}</strong>
                {project.description && <small>{project.description}</small>}
              </span>
            </button>
          ))}
        </SearchResultGroup>
      )}
      {results.sources.length > 0 && (
        <SearchResultGroup title="Sources">
          {results.sources.map((source) => (
            <button key={source.id} onClick={() => onSource(source)}>
              <FileText size={15} />
              <span>
                <strong>{source.title}</strong>
                <small>{source.authors || source.organization}</small>
              </span>
            </button>
          ))}
        </SearchResultGroup>
      )}
      {results.tags.length > 0 && (
        <SearchResultGroup title="Tags">
          {results.tags.map((tag) => (
            <button key={tag} onClick={() => onTag(tag)}>
              <Tag size={15} />
              <span>
                <strong>#{tag}</strong>
              </span>
            </button>
          ))}
        </SearchResultGroup>
      )}
      {!hasResults && (
        <div className="universal-search-empty">
          No matching research found.
        </div>
      )}
    </div>
  );
}

function SearchResultGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="search-result-group">
      <div>{title}</div>
      {children}
    </section>
  );
}
