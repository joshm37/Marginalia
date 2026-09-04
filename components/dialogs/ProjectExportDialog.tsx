"use client";

import { Clipboard, Download, FileText, X } from "lucide-react";
import { useEffect, useState } from "react";
import { requestCitation } from "@/lib/client/api";
import type { CitationStyle } from "@/lib/citations/types";
import type { Project, Source } from "@/lib/types";
import { sourcesToBibtex, sourcesToRis } from "@/lib/citations/export";

type ExportFormat = "txt" | "pdf" | "docx" | "bib" | "ris";

export function ProjectExportDialog({
  project,
  sources,
  onClose,
}: {
  project: Project;
  sources: Source[];
  onClose: () => void;
}) {
  const [style, setStyle] = useState<CitationStyle>("APA");
  const [format, setFormat] = useState<ExportFormat>("txt");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !exporting) onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [exporting, onClose]);

  async function formattedBibliography() {
    const entries = await Promise.all(
      sources.map(async (source) => ({
        citation: await requestCitation(source, style),
        annotation:
          source.includeInBibliography !== false
            ? source.bibliographyAnnotation?.trim()
            : "",
      })),
    );
    entries.sort((a, b) => a.citation.localeCompare(b.citation));
    return entries.map(({ citation, annotation }) => ({ citation, annotation: annotation || "" }));
  }

  function filename(extension: string) {
    const safeName =
      project.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
    const styleSuffix = format === "bib" || format === "ris" ? "" : `-${style.toLowerCase()}`;
    return `${safeName}${styleSuffix}-bibliography.${extension}`;
  }

  function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function exportBibliography() {
    setExporting(true);
    setError("");
    try {
      if (format === "bib" || format === "ris") {
        const content = format === "bib" ? sourcesToBibtex(sources) : sourcesToRis(sources);
        download(new Blob([content], { type: "text/plain;charset=utf-8" }), filename(format));
      } else {
        const entries = await formattedBibliography();
        const text = entries.map(({ citation, annotation }) => annotation ? `${citation}\n\n${annotation}` : citation).join("\n\n");
        if (format === "txt") {
          download(new Blob([text], { type: "text/plain;charset=utf-8" }), filename("txt"));
        } else if (format === "pdf") {
          const { jsPDF } = await import("jspdf");
          const pdf = new jsPDF({ unit: "pt", format: "letter" });
          pdf.setFont("times", "normal");
          pdf.setFontSize(12);
          const lines = pdf.splitTextToSize(text, 468) as string[];
          let y = 72;
          for (const line of lines) {
            if (y > 720) { pdf.addPage(); y = 72; }
            pdf.text(line, 72, y);
            y += 17;
          }
          pdf.save(filename("pdf"));
        } else {
          const { Document, Packer, Paragraph, TextRun } = await import("docx");
          const children = entries.flatMap(({ citation, annotation }) => [
            new Paragraph({ children: [new TextRun(citation)], spacing: { after: annotation ? 120 : 240 } }),
            ...(annotation ? [new Paragraph({ children: [new TextRun(annotation)], spacing: { after: 240 } })] : []),
          ]);
          const document = new Document({ sections: [{ properties: {}, children }] });
          download(await Packer.toBlob(document), filename("docx"));
        }
      }
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The bibliography could not be generated.",
      );
    } finally {
      setExporting(false);
    }
  }

  async function copyBibliography() {
    setExporting(true);
    setError("");
    try {
      const entries = await formattedBibliography();
      const text = entries.map(({ citation, annotation }) => annotation ? `${citation}\n\n${annotation}` : citation).join("\n\n");
      await navigator.clipboard.writeText(text);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The bibliography could not be copied.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !exporting) onClose();
      }}
    >
      <div
        className="modal bibliography-export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-bibliography-title"
      >
        <div className="card-header">
          <div>
            <div className="kicker">{project.name}</div>
            <h3 id="export-bibliography-title">Export bibliography</h3>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Close export dialog"
            onClick={onClose}
            disabled={exporting}
          >
            <X size={16} />
          </button>
        </div>
        <div className="bibliography-export-summary">
          <span><FileText size={17} /></span>
          <div>
            <strong>{sources.length} {sources.length === 1 ? "source" : "sources"}</strong>
            <p>Citations will be alphabetized. Included annotated-bibliography notes will appear beneath their source.</p>
          </div>
        </div>
        <div className="field">
          <label htmlFor="bibliography-style">CITATION STYLE</label>
          <select
            id="bibliography-style"
            value={style}
            onChange={(event) => setStyle(event.target.value as CitationStyle)}
          >
            <option value="APA">APA</option>
            <option value="MLA">MLA</option>
            <option value="Chicago">Chicago</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="bibliography-format">EXPORT FORMAT</label>
          <select id="bibliography-format" value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)}>
            <option value="txt">Plain text (.txt)</option>
            <option value="pdf">PDF document (.pdf)</option>
            <option value="docx">Word document (.docx)</option>
            <option value="bib">BibTeX (.bib)</option>
            <option value="ris">RIS (.ris)</option>
          </select>
        </div>
        {error && <div className="analysis-error" role="alert">{error}</div>}
        {!sources.length && (
          <p className="bibliography-export-empty">Add a source to this project before exporting a bibliography.</p>
        )}
        <div className="modal-footer">
          <button className="btn" onClick={onClose} disabled={exporting}>Cancel</button>
          <button className="btn" onClick={copyBibliography} disabled={exporting || !sources.length}>
            <Clipboard size={15} /> Copy
          </button>
          <button
            className="btn primary"
            onClick={exportBibliography}
            disabled={exporting || !sources.length}
          >
            <Download size={15} />
            {exporting ? "Formatting…" : `Export .${format}`}
          </button>
        </div>
      </div>
    </div>
  );
}
