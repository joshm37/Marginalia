"use client";

import { Clipboard, Download, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { requestBibliography } from "@/lib/client/api";
import { citationStyles, defaultCitationStyle, type CitationStyle } from "@/lib/citations/style-registry";
import { sourcesToBibtex, sourcesToCslJson, sourcesToRis } from "@/lib/citations/export";
import type { Project, Source } from "@/lib/types";
import { hangingPlainText, hangingRichTextHtml, normalizeCitationHtml, normalizeCitationText } from "@/lib/client/citation-output";
import { useDialogFocus } from "@/components/ui/useDialogFocus";

type ExportFormat = "txt" | "md" | "pdf" | "docx" | "bib" | "ris" | "json";
type SortMode = "style" | "title" | "date";
type Entry = { text: string; html: string; annotation: string };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

export function ProjectExportDialog({ project, sources, onClose }: { project: Project; sources: Source[]; onClose: () => void }) {
  const [style, setStyle] = useState<CitationStyle>(defaultCitationStyle);
  const [format, setFormat] = useState<ExportFormat>("txt");
  const [sort, setSort] = useState<SortMode>("style");
  const [includeAnnotations, setIncludeAnnotations] = useState(true);
  const [selected, setSelected] = useState(() => new Set(sources.map((source) => source.id)));
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const chosen = useMemo(() => sources.filter((source) => selected.has(source.id)), [selected, sources]);
  const machineReadable = format === "bib" || format === "ris" || format === "json";

  const close = useCallback(() => { if (!exporting) onClose(); }, [exporting, onClose]);
  const dialogRef = useDialogFocus(close);

  async function entries(): Promise<Entry[]> {
    const ordered = [...chosen];
    if (sort === "title") ordered.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "date") ordered.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const result = await requestBibliography(ordered, style, sort !== "style");
    return result.entries.map((entry, index) => { const source = ordered.find((item) => item.id === entry.id) ?? ordered[index]; return { ...entry, annotation: includeAnnotations && source?.includeInBibliography !== false ? source?.bibliographyAnnotation?.trim() || "" : "" }; });
  }
  function filename(extension: string) { const name = project.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project"; return `${name}-bibliography.${extension}`; }
  function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0); }
  const plainText = (items: Entry[]) => items.map((entry) => entry.annotation ? `${hangingPlainText(entry.text)}\n\n    ${entry.annotation.replace(/\n/g, "\n    ")}` : hangingPlainText(entry.text)).join("\n\n");
  const richHtml = (items: Entry[]) => `<div class="marginalia-bibliography">${items.map((entry) => `${hangingRichTextHtml(entry.html)}${entry.annotation ? `<p style="margin:0 0 12pt 36pt;text-indent:0">${escapeHtml(entry.annotation)}</p>` : ""}`).join("")}</div>`;

  async function exportBibliography() {
    setExporting(true); setError("");
    try {
      if (machineReadable) {
        const exportSources = includeAnnotations ? chosen : chosen.map((source) => ({ ...source, includeInBibliography: false }));
        const content = format === "bib" ? sourcesToBibtex(exportSources) : format === "ris" ? sourcesToRis(exportSources) : sourcesToCslJson(exportSources);
        download(new Blob([content], { type: format === "json" ? "application/json" : "text/plain;charset=utf-8" }), filename(format));
      } else {
        const items = await entries(); const text = plainText(items);
        if (format === "txt") download(new Blob([text], { type: "text/plain;charset=utf-8" }), filename("txt"));
        if (format === "md") download(new Blob([`# ${project.name} bibliography\n\n${items.map((entry) => `${hangingRichTextHtml(entry.html)}${entry.annotation ? `\n\n> ${entry.annotation.replace(/\n/g, "\n> ")}` : ""}`).join("\n\n" )}\n`], { type: "text/markdown;charset=utf-8" }), filename("md"));
        if (format === "pdf") {
          const pdfMake = (await import("pdfmake/build/pdfmake")).default;
          const fontFiles = (await import("pdfmake/build/vfs_fonts")).default;
          pdfMake.addVirtualFileSystem(fontFiles);
          const pdfRuns = (html: string) => { const document = new DOMParser().parseFromString(html, "text/html"); const output: Array<{ text: string; italics?: boolean; bold?: boolean }> = []; const walk = (node: Node, italics = false, bold = false) => { if (node.nodeType === Node.TEXT_NODE) output.push({ text: node.textContent || "", ...(italics ? { italics: true } : {}), ...(bold ? { bold: true } : {}) }); else node.childNodes.forEach((child) => walk(child, italics || (node instanceof HTMLElement && ["I", "EM"].includes(node.tagName)), bold || (node instanceof HTMLElement && ["B", "STRONG"].includes(node.tagName)))); }; document.body.childNodes.forEach((node) => walk(node)); return output; };
          const content = items.flatMap((entry) => [{ text: pdfRuns(normalizeCitationHtml(entry.html)), margin: [36, 0, 0, entry.annotation ? 4 : 12], leadingIndent: -36 }, ...(entry.annotation ? [{ text: entry.annotation, margin: [36, 0, 0, 12], italics: true }] : [])]);
          pdfMake.createPdf({ pageSize: "LETTER", pageMargins: [72, 72, 72, 72], defaultStyle: { font: "Roboto", fontSize: 11, lineHeight: 1.35 }, content: [{ text: "Bibliography", style: "heading" }, ...content] as never, styles: { heading: { fontSize: 16, bold: true, margin: [0, 0, 0, 18] } } }).download(filename("pdf"));
        }
        if (format === "docx") {
          const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
          const runs = (html: string) => { const document = new DOMParser().parseFromString(html, "text/html"); const output: InstanceType<typeof TextRun>[] = []; const walk = (node: Node, italic = false) => { if (node.nodeType === Node.TEXT_NODE) output.push(new TextRun({ text: node.textContent || "", italics: italic })); else node.childNodes.forEach((child) => walk(child, italic || (node instanceof HTMLElement && ["I", "EM"].includes(node.tagName)))); }; document.body.childNodes.forEach((node) => walk(node)); return output; };
          const children = [new Paragraph({ text: "Bibliography", heading: HeadingLevel.HEADING_1, spacing: { after: 240 } }), ...items.flatMap((entry) => [new Paragraph({ children: runs(normalizeCitationHtml(entry.html)), indent: { left: 720, hanging: 720 }, spacing: { after: entry.annotation ? 100 : 240 }, keepLines: true }), ...(entry.annotation ? [new Paragraph({ children: [new TextRun({ text: entry.annotation, italics: true })], indent: { left: 720 }, spacing: { after: 240 }, keepLines: true })] : [])])];
          download(await Packer.toBlob(new Document({ sections: [{ properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children }] })), filename("docx"));
        }
      }
      onClose();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The bibliography could not be generated."); } finally { setExporting(false); }
  }

  async function copyBibliography() {
    setExporting(true); setError("");
    try { const items = await entries(); const text = items.map((entry) => normalizeCitationText(entry.text) + (entry.annotation ? `\n\n${entry.annotation}` : "")).join("\n\n"); const html = richHtml(items); if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") await navigator.clipboard.write([new ClipboardItem({ "text/plain": new Blob([text], { type: "text/plain" }), "text/html": new Blob([html], { type: "text/html" }) })]); else await navigator.clipboard.writeText(text); onClose(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "The bibliography could not be copied."); } finally { setExporting(false); }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !exporting) onClose(); }}><div ref={dialogRef} tabIndex={-1} className="modal bibliography-export-modal" role="dialog" aria-modal="true" aria-labelledby="export-bibliography-title">
    <div className="card-header"><div><div className="kicker">{project.name}</div><h3 id="export-bibliography-title">Export bibliography</h3></div><button type="button" className="icon-btn" aria-label="Close export dialog" onClick={onClose} disabled={exporting}><X size={16}/></button></div>
    <p className="bibliography-export-count">{chosen.length} of {sources.length} sources selected</p>
    <div className="bibliography-export-grid"><div className="field"><label htmlFor="bibliography-style">STYLE</label><select id="bibliography-style" value={style} onChange={(event) => setStyle(event.target.value as CitationStyle)}>{citationStyles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
    <div className="field"><label htmlFor="bibliography-format">FORMAT</label><select id="bibliography-format" value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)}><option value="txt">Plain text</option><option value="md">Markdown</option><option value="pdf">PDF</option><option value="docx">Word</option><option value="bib">BibTeX</option><option value="ris">RIS</option><option value="json">CSL-JSON</option></select></div></div>
    <div className="bibliography-export-options">{!machineReadable && <div className="field"><label htmlFor="bibliography-sort">SORT</label><select id="bibliography-sort" value={sort} onChange={(event) => setSort(event.target.value as SortMode)}><option value="style">Style default</option><option value="title">Title</option><option value="date">Newest first</option></select></div>}{format !== "json" && <label className="bibliography-export-check"><input type="checkbox" checked={includeAnnotations} onChange={(event) => setIncludeAnnotations(event.target.checked)}/> Include annotations</label>}</div>
    <details className="bibliography-source-picker"><summary>Choose sources <span>{chosen.length}/{sources.length}</span></summary><label><input type="checkbox" checked={selected.size === sources.length} onChange={(event) => setSelected(event.target.checked ? new Set(sources.map((source) => source.id)) : new Set())}/> Select all</label><div>{sources.map((source) => <label key={source.id}><input type="checkbox" checked={selected.has(source.id)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(source.id)) next.delete(source.id); else next.add(source.id); return next; })}/><span>{source.title}</span></label>)}</div></details>
    {error && <div className="analysis-error" role="alert">{error}</div>}<div className="modal-footer"><button className="btn" onClick={onClose} disabled={exporting}>Cancel</button><button className="btn" onClick={copyBibliography} disabled={exporting || !chosen.length}><Clipboard size={15}/> Copy rich text</button><button className="btn primary" onClick={exportBibliography} disabled={exporting || !chosen.length}><Download size={15}/>{exporting ? "Formatting…" : `Export .${format}`}</button></div>
  </div></div>;
}
