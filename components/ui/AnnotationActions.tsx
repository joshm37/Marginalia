"use client";

import { Copy, Pencil, Trash2 } from "lucide-react";
import type { Annotation } from "@/lib/types";

export function AnnotationActions({
  annotation,
  onCopy,
  onEdit,
  onDelete,
}: {
  annotation: Annotation;
  onCopy: (annotation: Annotation) => void;
  onEdit: (annotation: Annotation) => void;
  onDelete: (annotation: Annotation) => void;
}) {
  return (
    <div className="annotation-actions">
      <button
        type="button"
        className="icon-btn"
        title="Copy quote"
        aria-label="Copy quote"
        onClick={() => onCopy(annotation)}
      >
        <Copy size={14} />
      </button>
      <button
        type="button"
        className="icon-btn"
        title="Edit excerpt"
        aria-label="Edit excerpt"
        onClick={() => onEdit(annotation)}
      >
        <Pencil size={14} />
      </button>
      <button
        type="button"
        className="icon-btn danger"
        title="Delete excerpt"
        aria-label="Delete excerpt"
        onClick={() => onDelete(annotation)}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

