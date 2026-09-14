"use client";

import { FileCheck2, FileUp, Link2, LoaderCircle, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { displayCitationNames, parseAuthorText } from "@/lib/citations/normalized";
import { ContributorFields } from "@/components/ui/ContributorFields";
import { readJsonResponse } from "@/lib/client/api";
import type { Annotation, Project, Source, SourceType } from "@/lib/types";
import type { MetadataField, MetadataProvenance } from "@/lib/metadata/types";
import { provenanceLabel } from "@/lib/metadata/provenance";
import { useDialogFocus } from "@/components/ui/useDialogFocus";
import { chooseLocalPdf, supportsPersistentFileHandles } from "@/lib/local-documents/file-picker";
import { sha256File } from "@/lib/local-documents/hash";
import { saveDeviceFileAssociation } from "@/lib/local-documents/device-store";
import { validateLocalPdf } from "@/lib/local-documents/validation";
import type { LocalDocumentPhase, LocalFileIdentity, LocalFileSelection } from "@/lib/local-documents/types";

const sourceTypes: SourceType[] = ["Article", "Report", "Case", "Bill", "Book", "Website"];
function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function optionalHttpUrl(value?: string) {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function TagInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const [options, setOptions] = useState<{ name: string; count: number }[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    fetch("/api/tags")
      .then((response) => (response.ok ? response.json() : []))
      .then(setOptions)
      .catch(() => undefined);
  }, []);
  const matches = options
    .filter(
      (option) =>
        !value.includes(option.name) &&
        (!input.trim() || option.name.includes(input.trim().toLowerCase())),
    )
    .slice(0, 8);
  function add(raw: string) {
    const name = raw.trim().toLowerCase();
    if (name && !value.includes(name)) onChange([...value, name]);
    setInput("");
    setOpen(false);
  }
  return (
    <div className="tag-input">
      <div className="tag-control">
        {value.map((tag) => (
          <span className="tag-chip" key={tag}>
            #{tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => onChange(value.filter((item) => item !== tag))}
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          value={input}
          placeholder="Type a tag and press Enter"
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(event) => {
            setInput(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              add(input);
            } else if (event.key === "Backspace" && !input && value.length)
              onChange(value.slice(0, -1));
          }}
        />
      </div>
      {open && matches.length > 0 && (
        <div className="tag-suggestions">
          {matches.map((option) => (
            <button
              type="button"
              key={option.name}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => add(option.name)}
            >
              <span>#{option.name}</span>
              <small>{option.count} uses</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function explainAnalysisResult(
  status: string,
  retrieval?: {
    httpStatus?: number;
    contentType?: string;
    responseSize?: number;
    finalUrl?: string;
  },
) {
  const httpStatus = retrieval?.httpStatus;
  if (!httpStatus)
    return "Marginalia could not connect to the website, so you may need to enter the citation details yourself.";
  if (httpStatus === 401 || httpStatus === 403)
    return "The website received Marginalia’s request but did not allow access to the article page.";
  if (httpStatus === 429)
    return "The website temporarily refused the request because it is receiving too many requests. You can try again later.";
  if (httpStatus >= 500)
    return "The website had a server problem while Marginalia was requesting the article. You can try again later.";
  if (status === "NON_HTML")
    return "The link worked, but it returned a file rather than a normal webpage, so Marginalia could not read its citation tags.";
  if (status === "NO_METADATA")
    return "The webpage loaded, but it did not publish recognizable citation information for Marginalia to read.";
  if (status === "PARTIAL")
    return "The webpage loaded and provided some citation information, but a few details were missing or could not be verified.";
  return "The webpage loaded successfully and Marginalia found enough information to prepare this citation.";
}

export function SourceModal({
  projects,
  initialProjectId,
  initialSource,
  onCreateProject,
  onOpenSource,
  onClose,
  onSave,
}: {
  projects: Project[];
  initialProjectId?: string;
  initialSource?: Source;
  onCreateProject: (name: string) => Promise<Project>;
  onOpenSource?: (source: Source) => void;
  onClose: () => void;
  onSave: (s: Source) => Source | void | Promise<Source | void>;
}) {
  const close = useCallback(() => onClose(), [onClose]);
  const dialogRef = useDialogFocus<HTMLElement>(close);
  const [step, setStep] = useState<"link" | "local" | "duplicate" | "details">(
    initialSource ? "details" : "link",
  );
  const [analysisUrl, setAnalysisUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisResult, setAnalysisResult] = useState<{
    status: string;
    warnings: string[];
    retrieval?: {
      httpStatus?: number;
      contentType?: string;
      responseSize?: number;
      finalUrl?: string;
    };
  }>();
  const [localPhase, setLocalPhase] = useState<LocalDocumentPhase>("selecting");
  const [localError, setLocalError] = useState("");
  const [localIdentity, setLocalIdentity] = useState<LocalFileIdentity>();
  const [localSelection, setLocalSelection] = useState<LocalFileSelection>();
  const [duplicateSource, setDuplicateSource] = useState<Source>();
  const [f, setF] = useState({
    title: initialSource?.title || "",
    authors: (initialSource?.citationData?.authors ?? parseAuthorText(initialSource?.authors || "")).map((name) => displayCitationNames([name])).join("\n"),
    organization: initialSource?.organization || "",
    doi: initialSource?.doi || "",
    containerTitle: initialSource?.containerTitle || "",
    volume: initialSource?.volume || "",
    issue: initialSource?.issue || "",
    pages: initialSource?.pages || "",
    editors: (initialSource?.citationData?.editors ?? parseAuthorText(initialSource?.editors || "")).map((name) => displayCitationNames([name])).join("\n"),
    translators: (initialSource?.citationData?.translators ?? parseAuthorText(initialSource?.translators || "")).map((name) => displayCitationNames([name])).join("\n"),
    edition: initialSource?.edition || "",
    publisherPlace: initialSource?.publisherPlace || "",
    isbn: initialSource?.isbn || "",
    issn: initialSource?.issn || "",
    accessedDate:
      initialSource?.accessedDate || new Date().toISOString().slice(0, 10),
    date: initialSource?.date || "",
    url: initialSource?.url || "",
    type: initialSource?.type || ("Article" as SourceType),
    description: initialSource?.description || "",
    bibliographyAnnotation: initialSource?.bibliographyAnnotation || "",
    tags: "",
    project:
      initialProjectId || initialSource?.projects[0] || projects[0]?.id || "",
    notes: initialSource?.notes || "",
  });
  const [citationData, setCitationData] = useState(initialSource?.citationData);
  const [metadataProvenance, setMetadataProvenance] =
    useState<MetadataProvenance>(initialSource?.metadataProvenance ?? {});
  const [reviewedFields, setReviewedFields] = useState<MetadataField[]>([]);
  const [tags, setTags] = useState<string[]>(initialSource?.tags || []);
  const [newProject, setNewProject] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  function setField<K extends keyof typeof f>(
    key: K,
    value: (typeof f)[K],
    metadataField?: MetadataField,
  ) {
    setF((current) => ({ ...current, [key]: value }));
    if (metadataField)
      setReviewedFields((current) =>
        current.includes(metadataField) ? current : [...current, metadataField],
      );
  }
  function fieldStatus(field: MetadataField) {
    const item = metadataProvenance[field];
    if (!item && !reviewedFields.includes(field)) return null;
    return (
      <span className="metadata-field-status">
        {reviewedFields.includes(field)
          ? "Manually confirmed"
          : provenanceLabel(item)}
      </span>
    );
  }
  async function analyzeLink(event: React.FormEvent) {
    event.preventDefault();
    const submittedUrl = /^https?:\/\//i.test(analysisUrl.trim())
      ? analysisUrl.trim()
      : `https://${analysisUrl.trim()}`;
    setAnalyzing(true);
    setAnalysisError("");
    try {
      const response = await fetch("/api/sources/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: submittedUrl }),
      });
      const data = await readJsonResponse(response);
      if (!response.ok)
        throw new Error(data.error ?? "Could not analyze this link");
      setAnalysisResult(data.analysis);
      setMetadataProvenance(data.provenance ?? {});
      setReviewedFields([]);
      setF((current) => ({
        ...current,
        title: data.title || "",
        authors: Array.isArray(data.authors) ? data.authors.join("\n") : "",
        organization: data.organization || "",
        doi: data.doi || "",
        containerTitle: data.containerTitle || "",
        volume: data.volume || "",
        issue: data.issue || "",
        pages: data.pages || "",
        editors: (data.citationData?.editors || []).map((name: NonNullable<Parameters<typeof displayCitationNames>[0]>[number]) => displayCitationNames([name])).join("\n"),
        translators: (data.citationData?.translators || []).map((name: NonNullable<Parameters<typeof displayCitationNames>[0]>[number]) => displayCitationNames([name])).join("\n"),
        edition: data.citationData?.edition || "",
        publisherPlace: data.citationData?.publisherPlace || "",
        isbn: data.citationData?.isbn?.join(", ") || "",
        issn: data.citationData?.issn?.join(", ") || "",
        accessedDate:
          data.citationData?.accessed?.["date-parts"]?.[0]
            ?.map((part: number, index: number) =>
              index ? String(part).padStart(2, "0") : String(part),
            )
            .join("-") || current.accessedDate,
        date: data.date || "",
        url: data.url || submittedUrl,
        type: sourceTypes.includes(data.type) ? data.type : "Website",
        description: data.description || "",
      }));
      setCitationData(data.citationData);
      setStep("details");
    } catch (error) {
      setAnalysisError(
        error instanceof Error ? error.message : "Could not analyze this link",
      );
    } finally {
      setAnalyzing(false);
    }
  }
  async function importLocalPdf() {
    setLocalError("");
    setLocalPhase("selecting");
    try {
      const selection = await chooseLocalPdf();
      if (!selection) return;
      validateLocalPdf(selection.file);
      setLocalSelection(selection);
      setLocalPhase("hashing");
      const sha256 = await sha256File(selection.file);
      const identity: LocalFileIdentity = {
        sha256,
        filename: selection.file.name,
        fileSize: selection.file.size,
        mimeType: selection.file.type || "application/pdf",
        ...(selection.file.lastModified
          ? { lastModified: new Date(selection.file.lastModified).toISOString() }
          : {}),
      };
      setLocalIdentity(identity);
      setLocalPhase("checking-duplicate");
      const duplicateResponse = await fetch(
        `/api/sources/check-duplicate?fileHash=${encodeURIComponent(sha256)}`,
      );
      const duplicate = await readJsonResponse(duplicateResponse);
      if (!duplicateResponse.ok)
        throw new Error(duplicate.error ?? "Could not check this document");
      if (duplicate.source) {
        setDuplicateSource(duplicate.source);
        setLocalPhase("ready");
        setStep("duplicate");
        return;
      }
      setLocalPhase("extracting");
      const { extractLocalPdfMetadata } = await import(
        "@/lib/local-documents/pdf-metadata"
      );
      const extracted = await extractLocalPdfMetadata(selection.file);
      let resolved = {
        title: extracted.title || selection.file.name.replace(/\.pdf$/i, ""),
        authors: extracted.authors,
        date: extracted.creationDate || "",
        doi: extracted.doi || "",
        isbn: extracted.isbn || "",
        description: extracted.subject || "",
        citationData: undefined as Source["citationData"],
        provenance: extracted.provenance,
        type: extracted.isbn ? ("Book" as SourceType) : ("Article" as SourceType),
        organization: "",
        containerTitle: "",
        volume: "",
        issue: "",
        pages: "",
      };
      if (extracted.doi || extracted.isbn) {
        setLocalPhase("enriching");
        try {
          const response = await fetch("/api/sources/enrich", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              doi: extracted.doi,
              isbn: extracted.isbn,
              title: resolved.title,
              authors: extracted.authors,
              date: extracted.creationDate,
              description: extracted.subject,
            }),
          });
          const enriched = await readJsonResponse(response);
          if (response.ok)
            resolved = {
              ...resolved,
              ...enriched,
              authors: enriched.authors ?? resolved.authors,
              citationData: enriched.citationData,
              provenance: enriched.provenance ?? resolved.provenance,
            };
        } catch {
          // Enrichment is best-effort; locally extracted metadata remains reviewable.
        }
      }
      setMetadataProvenance(resolved.provenance);
      setCitationData(resolved.citationData);
      setReviewedFields([]);
      setF((current) => ({
        ...current,
        title: resolved.title || "",
        authors: resolved.authors.join("\n"),
        organization: resolved.organization || "",
        doi: resolved.doi || "",
        containerTitle: resolved.containerTitle || "",
        volume: resolved.volume || "",
        issue: resolved.issue || "",
        pages: resolved.pages || "",
        editors: (resolved.citationData?.editors || []).map((name) => displayCitationNames([name])).join("\n"),
        translators: (resolved.citationData?.translators || []).map((name) => displayCitationNames([name])).join("\n"),
        edition: resolved.citationData?.edition || "",
        publisherPlace: resolved.citationData?.publisherPlace || "",
        isbn: resolved.isbn || "",
        issn: resolved.citationData?.issn?.join(", ") || "",
        accessedDate:
          resolved.citationData?.accessed?.["date-parts"]?.[0]
            ?.map((part: number, index: number) => index ? String(part).padStart(2, "0") : String(part))
            .join("-") || current.accessedDate,
        date: resolved.date || "",
        type: resolved.type,
        description: resolved.description || "",
        url: "",
      }));
      setLocalPhase("ready");
      setStep("details");
    } catch (error) {
      setLocalPhase("error");
      setLocalError(error instanceof Error ? error.message : "Could not read this PDF.");
    }
  }
  async function relinkDuplicate() {
    if (!duplicateSource || !localIdentity || !localSelection) return;
    try {
      await saveDeviceFileAssociation({
        sourceId: duplicateSource.id,
        ...localIdentity,
        handle: localSelection.handle,
      });
      setLocalPhase("relinked");
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Could not remember this document.");
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const isLocal = Boolean(localIdentity) || initialSource?.storageMode === "LOCAL";
    const safeUrl = optionalHttpUrl(f.url);
    if (!f.title || (!isLocal && !safeUrl)) return;
    const safeCitationData = citationData
      ? { ...citationData, url: optionalHttpUrl(citationData.url) }
      : citationData;
    const result = await onSave({
      id: initialSource?.id || uid("s"),
      title: f.title,
      authors: f.authors
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean)
        .join("\n"),
      organization: f.organization,
      doi: f.doi,
      containerTitle: f.containerTitle,
      volume: f.volume,
      issue: f.issue,
      pages: f.pages,
      editors: f.editors,
      translators: f.translators,
      edition: f.edition,
      publisherPlace: f.publisherPlace,
      isbn: f.isbn,
      issn: f.issn,
      accessedDate: f.accessedDate,
      citationData: safeCitationData,
      metadataProvenance,
      reviewedFields,
      date: f.date,
      url: safeUrl,
      storageMode: localIdentity ? "LOCAL" : initialSource?.storageMode ?? "WEB",
      localFile: localIdentity ?? initialSource?.localFile,
      type: f.type,
      description: f.description,
      bibliographyAnnotation: f.bibliographyAnnotation,
      tags,
      projects: f.project ? [f.project] : [],
      notes: f.notes,
      createdAt:
        initialSource?.createdAt || new Date().toISOString().slice(0, 10),
    });
    const saved = result || initialSource;
    if (saved && localIdentity && localSelection)
      await saveDeviceFileAssociation({
        sourceId: saved.id,
        ...localIdentity,
        handle: localSelection.handle,
      }).catch(() => undefined);
  }
  const isLocalSource =
    Boolean(localIdentity) || initialSource?.storageMode === "LOCAL";
  if (step === "link")
    return (
      <div className="modal-backdrop">
        <form ref={dialogRef as React.Ref<HTMLFormElement>} tabIndex={-1} className="modal source-link-modal" role="dialog" aria-modal="true" aria-labelledby="source-dialog-title" onSubmit={analyzeLink}>
          <div className="card-header">
            <h3 id="source-dialog-title">Save a source</h3>
            <button type="button" className="icon-btn" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
          <div className="source-link-intro">
            <span className="source-link-icon">
              <Link2 size={20} />
            </span>
            <h4>Cite from a link</h4>
            <p>
              Paste a webpage link and Marginalia will extract its citation
              information for you to review.
            </p>
          </div>
          <div className="field">
            <label>SOURCE LINK</label>
            <input
              required
              type="text"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              autoFocus
              value={analysisUrl}
              onChange={(event) => setAnalysisUrl(event.target.value)}
            />
          </div>
          {analysisError && (
            <div className="analysis-error" role="alert">{analysisError}</div>
          )}
          <button
            className="btn primary analyze-source-button"
            disabled={analyzing || !analysisUrl.trim()}
          >
            {analyzing ? "Analyzing source…" : "Analyze and continue"}
          </button>
          <button
            type="button"
            className="manual-citation-button"
            onClick={() => setStep("details")}
          >
            Cite manually
          </button>
          <button
            type="button"
            className="local-document-button"
            onClick={() => setStep("local")}
          >
            <FileUp size={15} /> Add local PDF
          </button>
        </form>
      </div>
    );
  if (step === "local")
    return (
      <div className="modal-backdrop">
        <div ref={dialogRef as React.Ref<HTMLDivElement>} tabIndex={-1} className="modal source-link-modal" role="dialog" aria-modal="true" aria-labelledby="local-source-dialog-title">
          <div className="card-header">
            <h3 id="local-source-dialog-title">Add local document</h3>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>
          <div className="source-link-intro">
            <span className="source-link-icon"><FileUp size={20} /></span>
            <h4>Choose a PDF</h4>
            <p>Marginalia identifies and reads citation details in your browser. The PDF itself never leaves this device.</p>
          </div>
          {localPhase !== "selecting" && localPhase !== "error" && (
            <div className="local-document-progress" role="status" aria-live="polite">
              <LoaderCircle size={16} className="spin" />
              <span>{({
                hashing: "Identifying document…",
                "checking-duplicate": "Checking your library…",
                extracting: "Reading PDF metadata…",
                enriching: "Verifying citation details…",
              } as Partial<Record<LocalDocumentPhase, string>>)[localPhase] ?? "Preparing document…"}</span>
            </div>
          )}
          {localError && <div className="analysis-error" role="alert">{localError}</div>}
          <button className="btn primary analyze-source-button" type="button" onClick={() => void importLocalPdf()} disabled={!["selecting", "error"].includes(localPhase)}>
            <FileUp size={15} /> {localPhase === "error" ? "Choose another PDF" : "Choose PDF"}
          </button>
          <button type="button" className="manual-citation-button" onClick={() => setStep("link")}>Back to link</button>
          {!supportsPersistentFileHandles() && (
            <small className="local-document-compatibility">This browser can save the source, but may ask you to locate the file again after reopening Marginalia.</small>
          )}
        </div>
      </div>
    );
  if (step === "duplicate" && duplicateSource)
    return (
      <div className="modal-backdrop">
        <div ref={dialogRef as React.Ref<HTMLDivElement>} tabIndex={-1} className="modal source-link-modal" role="dialog" aria-modal="true" aria-labelledby="duplicate-document-title">
          <div className="card-header">
            <h3 id="duplicate-document-title">Already in Marginalia</h3>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
          </div>
          <div className="source-link-intro local-duplicate-intro">
            <span className="source-link-icon"><FileCheck2 size={20} /></span>
            <h4>This document is already in Marginalia</h4>
            <p><strong>{duplicateSource.title}</strong></p>
            <p>The file contents match, even if the PDF was renamed or moved.</p>
          </div>
          {localError && <div className="analysis-error" role="alert">{localError}</div>}
          {localPhase === "relinked" && <div className="analysis-notice" role="status">This device is now linked to the document.</div>}
          <div className="local-duplicate-actions">
            <button type="button" className="btn primary" onClick={() => { onOpenSource?.(duplicateSource); onClose(); }}>Open source</button>
            <button type="button" className="btn" onClick={() => void relinkDuplicate()} disabled={localPhase === "relinked"}>{localPhase === "relinked" ? "Re-linked" : "Re-link this device"}</button>
          </div>
          <div className="field">
            <label>ADD TO ANOTHER PROJECT</label>
            <select defaultValue="" onChange={async (event) => {
              const projectId = event.target.value;
              if (!projectId || duplicateSource.projects.includes(projectId)) return;
              const response = await fetch(`/api/sources/${duplicateSource.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectId }),
              });
              const saved = await readJsonResponse(response);
              if (!response.ok) setLocalError(saved.error ?? "Could not add this project");
              else setDuplicateSource(saved);
            }}>
              <option value="">Select project</option>
              {projects.filter((project) => !duplicateSource.projects.includes(project.id)).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </div>
        </div>
      </div>
    );
  return (
    <div className="modal-backdrop">
      <form ref={dialogRef as React.Ref<HTMLFormElement>} tabIndex={-1} className="modal" role="dialog" aria-modal="true" aria-labelledby="source-dialog-title" onSubmit={submit}>
        <div className="card-header">
          <h3 id="source-dialog-title">{initialSource ? "Edit source" : "New source"}</h3>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        {analysisResult && (
          <div
            className={`analysis-notice analysis-notice-${analysisResult.status.toLowerCase()}`}
            role="status"
          >
            <strong>
              {analysisResult.status === "SUCCESS"
                ? "Citation details extracted"
                : analysisResult.status === "PARTIAL"
                ? "Some citation details were found"
                : analysisResult.status === "BLOCKED"
                  ? "The website blocked extraction"
                  : analysisResult.status === "NON_HTML"
                    ? "This link did not return a webpage"
                    : analysisResult.status === "FETCH_FAILED"
                      ? "The webpage could not be retrieved"
                      : "No citation metadata was found"}
            </strong>
            {analysisResult.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
            {analysisResult.status !== "SUCCESS" &&
              analysisResult.retrieval && (
                <div className="analysis-connection-details">
                  <p>
                    {explainAnalysisResult(
                      analysisResult.status,
                      analysisResult.retrieval,
                    )}
                  </p>
                  <p className="analysis-diagnostics">
                    <span>Technical details:</span>{" "}
                    {analysisResult.retrieval.httpStatus
                      ? `HTTP ${analysisResult.retrieval.httpStatus}`
                      : "No HTTP response"}
                    {analysisResult.retrieval.contentType
                      ? ` · ${analysisResult.retrieval.contentType.split(";")[0]}`
                      : ""}
                    {typeof analysisResult.retrieval.responseSize === "number"
                      ? ` · ${Math.round(analysisResult.retrieval.responseSize / 1024)} KB received`
                      : ""}
                  </p>
                </div>
              )}
            <small>
              {analysisResult.status === "SUCCESS"
                ? "Review the fields below before saving."
                : "No source has been saved. Review and correct the fields below before saving."}
            </small>
          </div>
        )}
        <div className="form-grid">
          <div className="field">
            <label>TITLE * {fieldStatus("title")}</label>
            <input
              required
              value={f.title}
              onChange={(e) => setField("title", e.target.value, "title")}
            />
          </div>
          <div className="form-row">
            <div className="field compact-textarea">
              <label>AUTHORS {fieldStatus("authors")}</label>
              <ContributorFields role="Author"
                value={f.authors}
                onChange={(value) => setField("authors", value, "authors")}
              />
            </div>
            <div className="field page-number-field">
              <label>ORGANIZATION / PUBLISHER {fieldStatus("publisher")}</label>
              <input
                value={f.organization}
                onChange={(e) => setField("organization", e.target.value, "publisher")}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="field compact-textarea">
              <label>EDITORS {fieldStatus("editors")}</label>
              <ContributorFields role="Editor"
                value={f.editors}
                onChange={(value) => setField("editors", value, "editors")}
              />
            </div>
            <div className="field compact-textarea">
              <label>TRANSLATORS {fieldStatus("translators")}</label>
              <ContributorFields role="Translator"
                value={f.translators}
                onChange={(value) => setField("translators", value, "translators")}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>EDITION {fieldStatus("edition")}</label>
              <input
                value={f.edition}
                onChange={(e) => setField("edition", e.target.value, "edition")}
              />
            </div>
            <div className="field">
              <label>PUBLISHER PLACE {fieldStatus("publisherPlace")}</label>
              <input
                value={f.publisherPlace}
                onChange={(e) => setField("publisherPlace", e.target.value, "publisherPlace")}
              />
            </div>
            <div className="field">
              <label>ACCESSED {fieldStatus("accessedDate")}</label>
              <input
                type="date"
                value={f.accessedDate}
                onChange={(e) => setField("accessedDate", e.target.value, "accessedDate")}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>ISBN {fieldStatus("isbn")}</label>
              <input
                value={f.isbn}
                onChange={(e) => setField("isbn", e.target.value, "isbn")}
              />
            </div>
            <div className="field">
              <label>ISSN {fieldStatus("issn")}</label>
              <input
                value={f.issn}
                onChange={(e) => setField("issn", e.target.value, "issn")}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>DATE {fieldStatus("publicationDate")}</label>
              <input
                type="date"
                value={f.date}
                onChange={(e) => setField("date", e.target.value, "publicationDate")}
              />
            </div>
            <div className="field">
              <label>SOURCE TYPE {fieldStatus("sourceType")}</label>
              <select
                value={f.type}
                onChange={(e) =>
                  setField("type", e.target.value as SourceType, "sourceType")
                }
              >
                {sourceTypes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          {isLocalSource ? (
            <div className="local-source-url-note">
              <strong>Stored locally</strong>
              <span>No web URL is required, and the file location stays on this device.</span>
            </div>
          ) : (
            <div className="field">
              <label>URL * {fieldStatus("url")}</label>
              <input
                required
                type="url"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                value={f.url}
                onChange={(e) => setField("url", e.target.value, "url")}
              />
            </div>
          )}
          <div className="field">
            <label>DOI {fieldStatus("doi")}</label>
            <input
              value={f.doi}
              onChange={(e) => setField("doi", e.target.value, "doi")}
            />
          </div>
          <div className="field">
            <label>CONTAINER TITLE / JOURNAL {fieldStatus("containerTitle")}</label>
            <input
              value={f.containerTitle}
              onChange={(e) => setField("containerTitle", e.target.value, "containerTitle")}
            />
          </div>
          <div className="form-row">
            <div className="field">
              <label>VOLUME {fieldStatus("volume")}</label>
              <input
                value={f.volume}
                onChange={(e) => setField("volume", e.target.value, "volume")}
              />
            </div>
            <div className="field">
              <label>ISSUE {fieldStatus("issue")}</label>
              <input
                value={f.issue}
                onChange={(e) => setField("issue", e.target.value, "issue")}
              />
            </div>
            <div className="field">
              <label>PAGES {fieldStatus("pages")}</label>
              <input
                value={f.pages}
                onChange={(e) => setField("pages", e.target.value, "pages")}
              />
            </div>
          </div>
          <div className="field">
            <label>DESCRIPTION {fieldStatus("description")}</label>
            <textarea
              value={f.description}
              onChange={(e) => setField("description", e.target.value, "description")}
            />
          </div>
          <div className="field">
            <label>TAGS</label>
            <TagInput value={tags} onChange={setTags} />
          </div>
          <div className="field">
            <label>PROJECT *</label>
            <div className="project-picker">
              <select
                required
                value={f.project}
                onChange={(e) => setF({ ...f, project: e.target.value })}
              >
                <option value="" disabled>
                  Select a project
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <div className="inline-create">
                <input
                  aria-label="New project name"
                  value={newProject}
                  onChange={(e) => setNewProject(e.target.value)}
                />
                <button
                  type="button"
                  className="btn"
                  disabled={!newProject.trim() || creatingProject}
                  onClick={async () => {
                    setCreatingProject(true);
                    try {
                      const project = await onCreateProject(newProject.trim());
                      setF({ ...f, project: project.id });
                      setNewProject("");
                    } finally {
                      setCreatingProject(false);
                    }
                  }}
                >
                  {creatingProject ? "Creating…" : "Create new"}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" type="submit">
            Save source
          </button>
        </div>
      </form>
    </div>
  );
}

export function AnnotationModal({
  sources,
  projects,
  initialSourceId,
  initialProjectId,
  initialAnnotation,
  onClose,
  onSave,
}: {
  sources: Source[];
  projects: Project[];
  initialSourceId?: string;
  initialProjectId?: string;
  initialAnnotation?: Annotation;
  onClose: () => void;
  onSave: (a: Annotation) => void | Promise<void>;
}) {
  const close = useCallback(() => onClose(), [onClose]);
  const dialogRef = useDialogFocus<HTMLFormElement>(close);
  const [f, setF] = useState({
    sourceId:
      initialAnnotation?.sourceId || initialSourceId || sources[0]?.id || "",
    selectedText: initialAnnotation?.selectedText || "",
    note: initialAnnotation?.note || "",
    pageNumber: initialAnnotation?.pageNumber || "",
    project:
      initialAnnotation?.projects[0] ||
      initialProjectId ||
      projects[0]?.id ||
      "",
    type: initialAnnotation?.type || ("Note" as Annotation["type"]),
  });
  const [tags, setTags] = useState<string[]>(initialAnnotation?.tags || []);
  return (
    <div className="modal-backdrop">
      <form
        ref={dialogRef}
        tabIndex={-1}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="excerpt-dialog-title"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            id: initialAnnotation?.id || uid("a"),
            sourceId: f.sourceId,
            selectedText: f.selectedText,
            note: f.note,
            tags,
            projects: f.project ? [f.project] : [],
            type: f.type,
            pageNumber: f.pageNumber || undefined,
            createdAt:
              initialAnnotation?.createdAt ||
              new Date().toISOString().slice(0, 10),
          });
        }}
      >
        <div className="card-header">
          <h3 id="excerpt-dialog-title">{initialAnnotation ? "Edit excerpt" : "New excerpt"}</h3>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>SOURCE</label>
            <select
              value={f.sourceId}
              onChange={(e) => {
                const sourceId = e.target.value;
                const source = sources.find((item) => item.id === sourceId);
                setF({
                  ...f,
                  sourceId,
                  project: source?.projects[0] || f.project,
                });
              }}
            >
              {sources.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>SELECTED PASSAGE</label>
            <textarea
              required
              value={f.selectedText}
              onChange={(e) => setF({ ...f, selectedText: e.target.value })}
            />
          </div>
          <div className="field">
            <label>NOTE</label>
            <textarea
              value={f.note}
              onChange={(e) => setF({ ...f, note: e.target.value })}
            />
          </div>
          <div className="form-row">
            <div className="field">
              <label>TYPE</label>
              <select
                value={f.type}
                onChange={(e) =>
                  setF({ ...f, type: e.target.value as Annotation["type"] })
                }
              >
                {[
                  "Evidence",
                  "Summary",
                  "Question",
                  "Counterargument",
                  "Note",
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>PAGE NUMBER</label>
              <input
                value={f.pageNumber}
                onChange={(e) => setF({ ...f, pageNumber: e.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label>TAGS</label>
            <TagInput value={tags} onChange={setTags} />
          </div>
          <div className="field">
            <label>PROJECT</label>
            <select
              value={f.project}
              onChange={(e) => setF({ ...f, project: e.target.value })}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary">
            {initialAnnotation ? "Update excerpt" : "Save excerpt"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function ProjectModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (p: Project) => void | Promise<void>;
}) {
  const close = useCallback(() => onClose(), [onClose]);
  const dialogRef = useDialogFocus<HTMLFormElement>(close);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  return (
    <div className="modal-backdrop">
      <form
        ref={dialogRef}
        tabIndex={-1}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-dialog-title"
        onSubmit={(e) => {
          e.preventDefault();
          if (name)
            onSave({
              id: uid("p"),
              name,
              description,
              isActive: true,
              deletedAt: null,
            });
        }}
      >
        <div className="card-header">
          <h3 id="project-dialog-title">New project</h3>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>PROJECT NAME</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label>DESCRIPTION</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary">Create project</button>
        </div>
      </form>
    </div>
  );
}
