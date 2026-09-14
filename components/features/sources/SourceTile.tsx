"use client";

import {
  BookOpen,
  CircleAlert,
  Copy,
  ExternalLink,
  FileText,
  Pencil,
  Trash2,
} from "lucide-react";
import type { Source } from "@/lib/types";

export function SourceTile({
  source,
  onOpen,
  onEdit,
  onCopy,
  onDelete,
}: {
  source: Source;
  onOpen: (source: Source) => void;
  onEdit: (source: Source) => void;
  onCopy: (source: Source) => void;
  onDelete: (source: Source) => void;
}) {
  const byline = [source.authors, source.organization, source.date]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="card source-card">
      <button
        type="button"
        className="source-card-main"
        onClick={() => onOpen(source)}
        aria-label={`Open ${source.title}`}
      >
        <span className="source-type-icon" aria-hidden="true">
          <FileText size={18} />
        </span>
        <span>
          <span className="source-kind">{source.type}</span>
          {source.metadataNeedsReview && (
            <span className="metadata-review-badge">
              <CircleAlert size={12} /> Metadata needs review
            </span>
          )}
          <h3>{source.title}</h3>
          {byline && <span className="source-meta">{byline}</span>}
          {source.description && (
            <span className="desc">{source.description}</span>
          )}
          {source.bibliographyAnnotation && (
            <span className="source-bibliography-preview">
              <BookOpen size={12} />
              {source.bibliographyAnnotation}
            </span>
          )}
          {source.tags.map((tag) => (
            <span className="pill" key={tag}>
              #{tag}
            </span>
          ))}
        </span>
      </button>
      <div className="source-actions" aria-label={`Actions for ${source.title}`}>
        <button
          type="button"
          className="icon-btn"
          title="Edit source"
          aria-label={`Edit ${source.title}`}
          onClick={() => onEdit(source)}
        >
          <Pencil size={15} />
        </button>
        <button
          type="button"
          className="icon-btn"
          title="Copy APA citation"
          aria-label={`Copy APA citation for ${source.title}`}
          onClick={() => onCopy(source)}
        >
          <Copy size={15} />
        </button>
        {source.url && (
          <a
            className="icon-btn"
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open original"
            aria-label={`Open original source for ${source.title} in a new tab`}
          >
            <ExternalLink size={15} />
          </a>
        )}
        <button
          type="button"
          className="icon-btn danger"
          title="Delete source"
          aria-label={`Delete ${source.title}`}
          onClick={() => onDelete(source)}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
}
