"use client";

import { ArrowLeft, BookOpen, Copy, ExternalLink, Highlighter, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CitationStyle } from "@/lib/citations/types";
import type { Annotation, Source } from "@/lib/types";
import { requestCitation } from "@/lib/client/api";
import { AnnotationActions } from "@/components/ui/AnnotationActions";

export function SourceDetail({
  source,
  annotations,
  onEdit,
  onDelete,
  onSaveBibliography,
  onToggleBibliography,
  onCopyAnnotation,
  onEditAnnotation,
  onDeleteAnnotation,
  onAddAnnotation,
  onBack,
}: {
  source: Source;
  annotations: Annotation[];
  onEdit: () => void;
  onDelete: () => void;
  onSaveBibliography: (
    bibliographyAnnotation: string,
    includeInBibliography: boolean,
  ) => void | Promise<void>;
  onToggleBibliography: (include: boolean) => void | Promise<void>;
  onCopyAnnotation: (annotation: Annotation) => void;
  onEditAnnotation: (annotation: Annotation) => void;
  onDeleteAnnotation: (annotation: Annotation) => void;
  onAddAnnotation: () => void;
  onBack: () => void;
}) {
  const [style, setStyle] = useState<CitationStyle>("APA");
  const [citationResult, setCitationResult] = useState({
    key: "",
    text: "",
    error: "",
  });
  const [copied, setCopied] = useState(false);
  const [bibliographyEditing, setBibliographyEditing] = useState(false);
  const [bibliographySaving, setBibliographySaving] = useState(false);
  const [bibliographyDraft, setBibliographyDraft] = useState(
    source.bibliographyAnnotation || "",
  );
  const bibliographyTextareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const textarea = bibliographyTextareaRef.current;
    if (!textarea || !bibliographyEditing) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
    textarea.focus();
  }, [bibliographyDraft, bibliographyEditing]);
  useEffect(() => {
    let active = true;
    const key = `${source.id}:${source.title}:${source.date}:${style}`;
    requestCitation(source, style)
      .then(
        (citation) =>
          active && setCitationResult({ key, text: citation, error: "" }),
      )
      .catch(
        (error) =>
          active &&
          setCitationResult({
            key,
            text: "",
            error:
              error instanceof Error
                ? error.message
                : "Could not format citation",
          }),
      );
    return () => {
      active = false;
    };
  }, [source, style]);
  const citationKey = `${source.id}:${source.title}:${source.date}:${style}`;
  const text = citationResult.key === citationKey ? citationResult.text : "";
  const citationError =
    citationResult.key === citationKey ? citationResult.error : "";
  return (
    <div className="source-detail-page">
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={15} /> Back
      </button>
      <div className="page-title detail-page-title source-detail-title">
        <div className="detail-heading-copy">
          <div className="kicker">{source.type}</div>
          <h2>{source.title}</h2>
          <p>
            {[source.authors, source.organization, source.date]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="detail-page-actions source-detail-actions">
          <a
            className="btn open-original-button"
            href={source.url}
            target="_blank"
            rel="noreferrer"
          >
            Open original <ExternalLink size={14} />
          </a>
          <button
            className="icon-btn source-edit-button"
            title="Edit citation information"
            aria-label="Edit citation information"
            onClick={onEdit}
          >
            <Pencil size={15} />
          </button>
          <button
            className="icon-btn source-delete-button danger"
            title="Delete source"
            aria-label="Delete source"
            onClick={onDelete}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <section className="card citation-header-card">
        <div className="citation-toolbar">
          <div className="citation-title">
            <BookOpen size={15} />
            <h3>Citation</h3>
          </div>
          <div className="citation-actions">
            <label className="citation-style-control">
              <span>Style</span>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value as CitationStyle)}
              >
                <option>APA</option>
                <option>MLA</option>
                <option>Chicago</option>
              </select>
            </label>
            <button
              className="btn citation-copy-button"
              disabled={!text}
              onClick={() => {
                navigator.clipboard?.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
            >
              <Copy size={14} /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
        <div className="citation citation-full">
          {citationError || text || "Formatting citation…"}
        </div>
      </section>
      <section className="card bibliography-annotation-card">
        <div className="bibliography-annotation-toolbar">
          <div className="bibliography-annotation-heading">
            <BookOpen size={14} />
            <div>
              <h3>Bibliography annotation</h3>
              <p>Summary and evaluation for your annotated bibliography.</p>
            </div>
          </div>
          <label className="bibliography-toggle">
            <span>Include in bibliography</span>
            <input
              type="checkbox"
              checked={source.includeInBibliography !== false}
              onChange={(event) => onToggleBibliography(event.target.checked)}
            />
            <i />
          </label>
        </div>
        {bibliographyEditing ? (
          <form
            className="bibliography-inline-editor"
            onSubmit={async (event) => {
              event.preventDefault();
              setBibliographySaving(true);
              try {
                await onSaveBibliography(
                  bibliographyDraft.trim(),
                  source.includeInBibliography !== false,
                );
                setBibliographyEditing(false);
              } catch {
                return;
              } finally {
                setBibliographySaving(false);
              }
            }}
          >
            <textarea
              ref={bibliographyTextareaRef}
              value={bibliographyDraft}
              onChange={(event) => setBibliographyDraft(event.target.value)}
              aria-label="Bibliography annotation"
            />
            <div>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setBibliographyDraft(source.bibliographyAnnotation || "");
                  setBibliographyEditing(false);
                }}
              >
                Cancel
              </button>
              <button className="btn primary" disabled={bibliographySaving}>
                {bibliographySaving ? "Saving…" : "Save annotation"}
              </button>
            </div>
          </form>
        ) : source.bibliographyAnnotation ? (
          <div className="bibliography-annotation-content">
            <p>{source.bibliographyAnnotation}</p>
            <button
              className="icon-btn"
              onClick={() => setBibliographyEditing(true)}
            >
              <Pencil size={14} />
            </button>
          </div>
        ) : (
          <button
            className="text-button bibliography-add-button"
            onClick={() => setBibliographyEditing(true)}
          >
            <Plus size={13} /> Add an annotation
          </button>
        )}
      </section>
      <section className="card source-annotations-card">
        <div className="section-list-heading">
          <div>
            <h3>Excerpts</h3>
            <p>{annotations.length} captured from this source.</p>
          </div>
          <button className="btn primary" onClick={onAddAnnotation}>
            <Plus size={15} /> New excerpt
          </button>
        </div>
        {annotations.length ? (
          annotations.map((annotation) => (
            <article
              className="annotation source-detail-annotation"
              key={annotation.id}
            >
              <div className="annotation-top">
                <div className="annotation-context">
                  <span className="annotation-type">
                    <Highlighter size={12} /> {annotation.type}
                  </span>
                  <span className="source-meta">
                    {annotation.pageNumber
                      ? `Page ${annotation.pageNumber} · `
                      : ""}
                    {annotation.createdAt}
                  </span>
                </div>
                <AnnotationActions
                  annotation={annotation}
                  onCopy={onCopyAnnotation}
                  onEdit={onEditAnnotation}
                  onDelete={onDeleteAnnotation}
                />
              </div>
              <div className="quote">{annotation.selectedText}</div>
              {annotation.note && <div className="note">{annotation.note}</div>}
              <div className="annotation-tags">
                {annotation.tags.map((tag) => (
                  <span className="pill" key={tag}>
                    #{tag}
                  </span>
                ))}
              </div>
            </article>
          ))
        ) : (
          <div className="empty">
            <Highlighter size={24} />
            <h3>No excerpts yet</h3>
            <p>Highlight text with the extension to add it here.</p>
          </div>
        )}
      </section>
    </div>
  );
}
