"use client";

import { Archive, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Project } from "@/lib/types";

export function ProjectDeleteModal({
  project,
  onClose,
  onConfirm,
}: {
  project: Project;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !deleting) onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [deleting, onClose]);
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !deleting) onClose();
      }}
    >
      <div
        className="modal project-delete-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-project-title"
      >
        <div className="delete-modal-icon">
          <Trash2 size={20} />
        </div>
        <h3 id="delete-project-title">Delete project permanently?</h3>
        <p>
          <strong>{project.name}</strong>, every source saved to it, and all
          excerpts from those sources will be permanently deleted. This cannot
          be undone.
        </p>
        <div className="modal-footer">
          <button className="btn" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button
            className="btn danger-solid"
            disabled={deleting}
            onClick={async () => {
              setDeleting(true);
              await onConfirm();
              setDeleting(false);
            }}
          >
            <Trash2 size={14} />
            {deleting ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DeleteConfirmationModal({
  title,
  subject,
  description,
  onClose,
  onConfirm,
}: {
  title: string;
  subject: string;
  description: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !deleting) onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [deleting, onClose]);
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !deleting) onClose();
      }}
    >
      <div
        className="modal project-delete-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-item-title"
      >
        <div className="delete-modal-icon">
          <Trash2 size={20} />
        </div>
        <h3 id="delete-item-title">{title}</h3>
        <p>
          <strong>{subject}</strong> {description}
        </p>
        <div className="modal-footer">
          <button className="btn" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button
            className="btn danger-solid"
            disabled={deleting}
            onClick={async () => {
              setDeleting(true);
              await onConfirm();
              setDeleting(false);
            }}
          >
            <Trash2 size={14} />
            {deleting ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ArchiveConfirmationModal({
  project,
  onClose,
  onConfirm,
}: {
  project: Project;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const [archiving, setArchiving] = useState(false);
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !archiving) onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [archiving, onClose]);
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !archiving) onClose();
      }}
    >
      <div
        className="modal project-delete-modal archive-confirmation-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="archive-project-title"
      >
        <div className="delete-modal-icon archive-modal-icon">
          <Archive size={20} />
        </div>
        <h3 id="archive-project-title">Archive this project?</h3>
        <p>
          <strong>{project.name}</strong> will be hidden from your dashboard.
          Its sources and excerpts will stay safe, and you can restore it later.
        </p>
        <div className="modal-footer">
          <button className="btn" onClick={onClose} disabled={archiving}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={archiving}
            onClick={async () => {
              setArchiving(true);
              await onConfirm();
              setArchiving(false);
            }}
          >
            <Archive size={14} />
            {archiving ? "Archiving…" : "Archive project"}
          </button>
        </div>
      </div>
    </div>
  );
}
