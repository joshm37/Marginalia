"use client";

import { ArrowRight, FileText, Highlighter, Search, Tag, X } from "lucide-react";
import { useState } from "react";
import type { Annotation, Source } from "@/lib/types";

export function TagsView({
  sources,
  annotations,
  initialTag,
  onSource,
}: {
  sources: Source[];
  annotations: Annotation[];
  initialTag: string | null;
  onSource: (source: Source) => void;
}) {
  const [tagQuery, setTagQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(initialTag);
  const tags = new Map<string, { sources: number; excerpts: number }>();
  sources
    .flatMap((s) => s.tags)
    .forEach((tag) => {
      const counts = tags.get(tag) || { sources: 0, excerpts: 0 };
      tags.set(tag, { ...counts, sources: counts.sources + 1 });
    });
  annotations
    .flatMap((a) => a.tags)
    .forEach((tag) => {
      const counts = tags.get(tag) || { sources: 0, excerpts: 0 };
      tags.set(tag, { ...counts, excerpts: counts.excerpts + 1 });
    });
  const visibleTags = [...tags.entries()]
    .filter(([tag]) =>
      tag.toLowerCase().includes(tagQuery.toLowerCase().trim()),
    )
    .sort(
      (a, b) => b[1].sources + b[1].excerpts - (a[1].sources + a[1].excerpts),
    );
  const taggedSources = selectedTag
    ? sources.filter((source) => source.tags.includes(selectedTag))
    : [];
  const taggedExcerpts = selectedTag
    ? annotations.filter((excerpt) => excerpt.tags.includes(selectedTag))
    : [];
  return (
    <>
      <div className="page-title">
        <div>
          <div className="kicker">Organization</div>
          <h2>Tags</h2>
          <p>Explore related sources and excerpts by topic.</p>
        </div>
      </div>
      <div className="tags-workspace">
        <section className="card tags-browser">
          <div className="tags-search">
            <Search size={15} />
            <input
              value={tagQuery}
              onChange={(event) => setTagQuery(event.target.value)}
              aria-label="Search tags"
            />
          </div>
          <div className="tag-grid">
            {visibleTags.map(([tag, counts]) => (
              <button
                className={`tag-card ${selectedTag === tag ? "active" : ""}`}
                key={tag}
                onClick={() => setSelectedTag(tag)}
              >
                <span className="tag-card-icon">
                  <Tag size={14} />
                </span>
                <strong>#{tag}</strong>
                <small>
                  {counts.sources} sources · {counts.excerpts} excerpts
                </small>
                <ArrowRight size={13} />
              </button>
            ))}
            {!visibleTags.length && (
              <div className="tags-empty">No matching tags.</div>
            )}
          </div>
        </section>
        <section className="card tag-detail">
          {selectedTag ? (
            <>
              <div className="tag-detail-heading">
                <div>
                  <div className="kicker">Selected tag</div>
                  <h3>#{selectedTag}</h3>
                </div>
                <button
                  className="icon-btn"
                  aria-label="Close tag details"
                  onClick={() => setSelectedTag(null)}
                >
                  <X size={15} />
                </button>
              </div>
              <div className="tag-detail-section">
                <h4>Sources</h4>
                {taggedSources.map((source) => (
                  <button
                    className="tag-related-item"
                    key={source.id}
                    onClick={() => onSource(source)}
                  >
                    <FileText size={15} />
                    <span>
                      <strong>{source.title}</strong>
                      <small>{source.authors || source.organization}</small>
                    </span>
                    <ArrowRight size={13} />
                  </button>
                ))}
                {!taggedSources.length && <p>No directly tagged sources.</p>}
              </div>
              <div className="tag-detail-section">
                <h4>Excerpts</h4>
                {taggedExcerpts.map((excerpt) => {
                  const source = sources.find(
                    (item) => item.id === excerpt.sourceId,
                  );
                  return (
                    <button
                      className="tag-related-item excerpt"
                      key={excerpt.id}
                      disabled={!source}
                      onClick={() => source && onSource(source)}
                    >
                      <Highlighter size={15} />
                      <span>
                        <strong>{excerpt.selectedText}</strong>
                        <small>{source?.title}</small>
                      </span>
                      <ArrowRight size={13} />
                    </button>
                  );
                })}
                {!taggedExcerpts.length && <p>No tagged excerpts.</p>}
              </div>
            </>
          ) : (
            <div className="tag-detail-empty">
              <Tag size={25} />
              <h3>Select a tag</h3>
              <p>See every related source and excerpt in one place.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
