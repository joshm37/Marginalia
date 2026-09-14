"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, FileSearch, Highlighter, LoaderCircle, Pencil, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PdfPage, type PdfDocumentProxyLike } from "./PdfPage";
import { chooseLocalPdf } from "@/lib/local-documents/file-picker";
import { getLinkedFile, saveDeviceFileAssociation } from "@/lib/local-documents/device-store";
import { sha256File } from "@/lib/local-documents/hash";
import { validateLocalPdf } from "@/lib/local-documents/validation";
import type { PdfTextAnchor } from "@/lib/local-documents/excerpt-anchor";
import { postJson, readJsonResponse } from "@/lib/client/api";
import type { Annotation, AnnotationType, Project, Source } from "@/lib/types";

const excerptTypes: AnnotationType[] = ["Evidence", "Summary", "Question", "Counterargument", "Note"];
type ReaderState = "loading" | "ready" | "unavailable" | "password" | "error";

export function LocalPdfReader({ source, projects, initialExcerpts }: { source: Source; projects: Project[]; initialExcerpts: Annotation[] }) {
  const [state, setState] = useState<ReaderState>("loading");
  const [error, setError] = useState("");
  const [pdfDocument, setPdfDocument] = useState<PdfDocumentProxyLike>();
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [page, setPage] = useState(1);
  const [excerpts, setExcerpts] = useState(initialExcerpts);
  const [draft, setDraft] = useState<PdfTextAnchor>();
  const [editing, setEditing] = useState<Annotation>();
  const [selectedExcerpt, setSelectedExcerpt] = useState<string>();
  const [textPages, setTextPages] = useState<Record<number, boolean>>({});
  const passwordContinuation = useRef<((password: string) => void) | null>(null);

  const loadPdf = useCallback(async (selected: File, suppliedPassword?: string) => {
    setState("loading");
    setError("");
    try {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await selected.arrayBuffer()), password: suppliedPassword });
      loadingTask.onPassword = (updatePassword: (password: string) => void, reason: number) => {
        passwordContinuation.current = updatePassword;
        setPasswordError(reason === 2);
        setState("password");
      };
      const loaded = await loadingTask.promise;
      setPdfDocument(loaded as unknown as PdfDocumentProxyLike);
      setPage(1);
      setState("ready");
    } catch (caught) {
      if (passwordContinuation.current) return;
      setState("error");
      setError(
        caught instanceof Error && /invalid|malformed|format/i.test(`${caught.name} ${caught.message}`)
          ? "This PDF appears to be malformed or unreadable."
          : caught instanceof Error
            ? caught.message
            : "This PDF could not be opened.",
      );
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const linked = await getLinkedFile(source.id);
        if (!active) return;
        if (!linked) setState("unavailable");
        else {
          await loadPdf(linked);
        }
      } catch {
        if (active) setState("unavailable");
      }
    })();
    return () => { active = false; };
  }, [loadPdf, source.id]);

  useEffect(() => () => { if (pdfDocument) void pdfDocument.destroy(); }, [pdfDocument]);

  async function locateFile() {
    setError("");
    try {
      const selection = await chooseLocalPdf();
      if (!selection) return;
      validateLocalPdf(selection.file);
      setState("loading");
      const sha256 = await sha256File(selection.file);
      if (sha256 !== source.localFile?.sha256) {
        setState("unavailable");
        setError("That PDF does not match this source. Nothing was changed.");
        return;
      }
      await saveDeviceFileAssociation({
        sourceId: source.id,
        sha256,
        filename: selection.file.name,
        fileSize: selection.file.size,
        mimeType: selection.file.type || "application/pdf",
        ...(selection.file.lastModified ? { lastModified: new Date(selection.file.lastModified).toISOString() } : {}),
        handle: selection.handle,
      });
      await loadPdf(selection.file);
    } catch (caught) {
      setState("unavailable");
      setError(caught instanceof Error ? caught.message : "Could not locate this PDF.");
    }
  }

  function jumpToPage(nextPage: number, excerptId?: string) {
    const bounded = Math.max(1, Math.min(pdfDocument?.numPages ?? 1, nextPage));
    setPage(bounded);
    if (excerptId) setSelectedExcerpt(excerptId);
    document.getElementById(`pdf-page-${bounded}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const currentProjectIds = source.projects.filter((id) => projects.some((project) => project.id === id && project.isActive));
  const pageExcerpts = useMemo(() => {
    const grouped = new Map<number, Annotation[]>();
    for (const excerpt of excerpts) {
      const pageNumber = Number(excerpt.locationData?.pageNumber || excerpt.pageNumber);
      if (Number.isInteger(pageNumber) && pageNumber > 0)
        grouped.set(pageNumber, [...(grouped.get(pageNumber) ?? []), excerpt]);
    }
    return grouped;
  }, [excerpts]);
  const reportText = useCallback((pageNumber: number, available: boolean) => {
    setTextPages((current) => current[pageNumber] === available ? current : { ...current, [pageNumber]: available });
  }, []);
  const showTextlessWarning =
    textPages[1] === false && !Object.values(textPages).some(Boolean);

  return (
    <main className="pdf-reader-shell">
      <header className="pdf-reader-header">
        <Link className="back-button" href={`/sources/${source.id}`}><ArrowLeft size={15} /> Source</Link>
        <div><span className="kicker">Local PDF</span><h1>{source.title}</h1><p>{source.localFile?.filename}</p></div>
        <div className="pdf-reader-header-actions">
          <Link className="btn" href={`/sources/${source.id}`}><BookOpen size={14} /> Citation and metadata</Link>
          {pdfDocument && <div className="pdf-page-navigation"><button className="icon-btn" aria-label="Previous page" onClick={() => jumpToPage(page - 1)} disabled={page <= 1}><ChevronLeft size={15} /></button><label htmlFor="reader-page">Page</label><input id="reader-page" type="number" min={1} max={pdfDocument.numPages} value={page} onChange={(event) => jumpToPage(Number(event.target.value))} /><span>of {pdfDocument.numPages}</span><button className="icon-btn" aria-label="Next page" onClick={() => jumpToPage(page + 1)} disabled={page >= pdfDocument.numPages}><ChevronRight size={15} /></button></div>}
        </div>
      </header>

      {(state === "unavailable" || state === "error") && (
        <section className="pdf-reader-unavailable">
          <FileSearch size={28} />
          <h2>Local file not available on this device</h2>
          <p>The source, citation, and saved excerpts are still available. Locate the original PDF to continue reading.</p>
          {error && <p className="analysis-error" role="alert">{error}</p>}
          <button className="btn primary" onClick={() => void locateFile()}><FileSearch size={14} /> Locate file</button>
          <Link className="btn" href={`/sources/${source.id}`}>View source metadata</Link>
        </section>
      )}
      {state === "loading" && <div className="pdf-reader-loading" role="status"><LoaderCircle className="spin" /> Opening PDF locally…</div>}
      {state === "password" && (
        <form className="pdf-password-card" onSubmit={(event) => { event.preventDefault(); passwordContinuation.current?.(password); passwordContinuation.current = null; setState("loading"); }}>
          <h2>Password-protected PDF</h2><p>Enter the document password. It is used only in this browser and is not stored.</p>
          <label htmlFor="pdf-password">PDF password</label><input id="pdf-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={passwordError} />
          {passwordError && <p role="alert">That password did not open the PDF.</p>}
          <button className="btn primary">Open PDF</button>
        </form>
      )}
      {showTextlessWarning && <div className="pdf-scanned-warning" role="status">This PDF may be scanned or have a weak text layer. You can read it, but text selection may be unavailable. OCR is not enabled.</div>}

      <div className="pdf-reader-layout">
        {pdfDocument && (
          <section className="pdf-document" aria-label={`PDF document: ${source.title}`}>
            {Array.from({ length: pdfDocument.numPages }, (_, index) => index + 1).map((pageNumber) => (
              <PdfPage key={pageNumber} document={pdfDocument} pageNumber={pageNumber} excerpts={pageExcerpts.get(pageNumber) ?? []} onCapture={setDraft} onTextAvailability={reportText} />
            ))}
          </section>
        )}
        <aside className="pdf-excerpt-panel" aria-label="Source excerpts">
          <div className="pdf-panel-heading"><div><span className="kicker">Research notes</span><h2>Excerpts</h2></div><span>{excerpts.length}</span></div>
          {(draft || editing) && <ExcerptEditor anchor={draft} excerpt={editing} projects={projects} defaultProjects={currentProjectIds.length ? currentProjectIds : source.projects.slice(0, 1)} onCancel={() => { setDraft(undefined); setEditing(undefined); }} onSaved={(saved) => { setExcerpts((current) => editing ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]); setDraft(undefined); setEditing(undefined); setSelectedExcerpt(saved.id); }} source={source} />}
          {!draft && !editing && !excerpts.length && <div className="pdf-panel-empty"><Highlighter size={20} /><p>Select text in the PDF, then choose “Save excerpt.”</p></div>}
          <ol className="pdf-excerpt-list">
            {excerpts.map((excerpt) => (
              <li key={excerpt.id} className={selectedExcerpt === excerpt.id ? "selected" : ""}>
                <button className="pdf-excerpt-jump" onClick={() => jumpToPage(Number(excerpt.locationData?.pageNumber || excerpt.pageNumber || 1), excerpt.id)}><span>Page {excerpt.locationData?.pageNumber || excerpt.pageNumber || "—"} · {excerpt.type}</span><q>{excerpt.selectedText}</q>{excerpt.note && <small>{excerpt.note}</small>}</button>
                <div><button className="icon-btn" aria-label={`Edit excerpt from page ${excerpt.pageNumber || "unknown"}`} onClick={() => setEditing(excerpt)}><Pencil size={13} /></button><button className="icon-btn danger" aria-label={`Delete excerpt from page ${excerpt.pageNumber || "unknown"}`} onClick={async () => { if (!window.confirm("Delete this excerpt permanently?")) return; const response = await fetch(`/api/excerpts/${excerpt.id}`, { method: "DELETE" }); if (response.ok) setExcerpts((current) => current.filter((item) => item.id !== excerpt.id)); else setError("Could not delete this excerpt. Try again."); }}><Trash2 size={13} /></button></div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </main>
  );
}

function ExcerptEditor({ anchor, excerpt, projects, defaultProjects, source, onCancel, onSaved }: { anchor?: PdfTextAnchor; excerpt?: Annotation; projects: Project[]; defaultProjects: string[]; source: Source; onCancel: () => void; onSaved: (excerpt: Annotation) => void }) {
  const [note, setNote] = useState(excerpt?.note || "");
  const [type, setType] = useState<AnnotationType>(excerpt?.type || "Evidence");
  const [tags, setTags] = useState((excerpt?.tags || []).join(", "));
  const [projectIds, setProjectIds] = useState(excerpt?.projects.length ? excerpt.projects : defaultProjects);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const exact = anchor?.exact || excerpt?.selectedText || "";
  return (
    <form className="pdf-excerpt-editor" onSubmit={async (event) => {
      event.preventDefault(); setSaving(true); setError("");
      try {
        const locationData = anchor ?? excerpt?.locationData;
        const payload = { sourceId: source.id, selectedText: exact, surroundingText: locationData ? `${locationData.prefix || ""}${exact}${locationData.suffix || ""}` : excerpt?.surroundingText, note, type, tags: tags.split(/[,\n]+/).map((value) => value.trim().toLowerCase()).filter(Boolean), projects: projectIds, locationData };
        let saved: Annotation;
        if (excerpt) {
          const response = await fetch(`/api/excerpts/${excerpt.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          const data = await readJsonResponse(response);
          if (!response.ok) throw new Error(data.error ?? "Could not update excerpt");
          saved = data as Annotation;
        } else saved = await postJson<Annotation>("/api/excerpts", payload);
        onSaved(saved);
      } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save excerpt"); }
      finally { setSaving(false); }
    }}>
      <div className="pdf-editor-heading"><strong>{excerpt ? "Edit excerpt" : "New excerpt"}</strong><button type="button" className="icon-btn" aria-label="Close excerpt editor" onClick={onCancel}><X size={14} /></button></div>
      <blockquote>{exact}</blockquote>
      <label htmlFor="pdf-excerpt-note">Note</label><textarea id="pdf-excerpt-note" value={note} onChange={(event) => setNote(event.target.value)} autoFocus />
      <label htmlFor="pdf-excerpt-type">Purpose</label><select id="pdf-excerpt-type" value={type} onChange={(event) => setType(event.target.value as AnnotationType)}>{excerptTypes.map((item) => <option key={item}>{item}</option>)}</select>
      <label htmlFor="pdf-excerpt-tags">Tags</label><input id="pdf-excerpt-tags" value={tags} onChange={(event) => setTags(event.target.value)} aria-describedby="pdf-tags-help" /><small id="pdf-tags-help">Separate multiple tags with commas.</small>
      <fieldset><legend>Projects</legend>{projects.map((project) => <label key={project.id}><input type="checkbox" checked={projectIds.includes(project.id)} onChange={(event) => setProjectIds((current) => event.target.checked ? [...current, project.id] : current.filter((id) => id !== project.id))} /> {project.name}</label>)}</fieldset>
      {error && <p className="analysis-error" role="alert">{error}</p>}
      <button className="btn primary" disabled={saving || !projectIds.length}>{saving ? "Saving…" : "Save excerpt"}</button>
    </form>
  );
}
