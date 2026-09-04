"use client";

import { Link2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { displayCitationNames } from "@/lib/citations/normalized";
import { readJsonResponse } from "@/lib/client/api";
import type { Annotation, Project, Source, SourceType } from "@/lib/types";

const sourceTypes: SourceType[] = ["Article", "Report", "Case", "Bill", "Book", "Website"];
function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
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
  onClose,
  onSave,
}: {
  projects: Project[];
  initialProjectId?: string;
  initialSource?: Source;
  onCreateProject: (name: string) => Promise<Project>;
  onClose: () => void;
  onSave: (s: Source) => void | Promise<void>;
}) {
  const [step, setStep] = useState<"link" | "details">(
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
  const [f, setF] = useState({
    title: initialSource?.title || "",
    authors: initialSource?.authors || "",
    organization: initialSource?.organization || "",
    doi: initialSource?.doi || "",
    containerTitle: initialSource?.containerTitle || "",
    volume: initialSource?.volume || "",
    issue: initialSource?.issue || "",
    pages: initialSource?.pages || "",
    editors: initialSource?.editors || "",
    translators: initialSource?.translators || "",
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
  const [tags, setTags] = useState<string[]>(initialSource?.tags || []);
  const [newProject, setNewProject] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
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
        editors: displayCitationNames(data.citationData?.editors || []),
        translators: displayCitationNames(data.citationData?.translators || []),
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
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title || !f.url) return;
    onSave({
      id: initialSource?.id || uid("s"),
      title: f.title,
      authors: f.authors
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean)
        .join(", "),
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
      citationData,
      date: f.date,
      url: f.url,
      type: f.type,
      description: f.description,
      bibliographyAnnotation: f.bibliographyAnnotation,
      tags,
      projects: f.project ? [f.project] : [],
      notes: f.notes,
      createdAt:
        initialSource?.createdAt || new Date().toISOString().slice(0, 10),
    });
  }
  if (step === "link")
    return (
      <div className="modal-backdrop">
        <form className="modal source-link-modal" onSubmit={analyzeLink}>
          <div className="card-header">
            <h3>Save a source</h3>
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
            <div className="analysis-error">{analysisError}</div>
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
        </form>
      </div>
    );
  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={submit}>
        <div className="card-header">
          <h3>{initialSource ? "Edit source" : "New source"}</h3>
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
            <label>TITLE *</label>
            <input
              required
              value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })}
            />
          </div>
          <div className="form-row">
            <div className="field compact-textarea">
              <label>AUTHORS · ONE PER LINE</label>
              <textarea
                value={f.authors}
                onChange={(e) => setF({ ...f, authors: e.target.value })}
              />
            </div>
            <div className="field page-number-field">
              <label>ORGANIZATION / PUBLISHER</label>
              <input
                value={f.organization}
                onChange={(e) => setF({ ...f, organization: e.target.value })}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="field compact-textarea">
              <label>EDITORS · ONE PER LINE</label>
              <textarea
                value={f.editors}
                onChange={(e) => setF({ ...f, editors: e.target.value })}
              />
            </div>
            <div className="field compact-textarea">
              <label>TRANSLATORS · ONE PER LINE</label>
              <textarea
                value={f.translators}
                onChange={(e) => setF({ ...f, translators: e.target.value })}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>EDITION</label>
              <input
                value={f.edition}
                onChange={(e) => setF({ ...f, edition: e.target.value })}
              />
            </div>
            <div className="field">
              <label>PUBLISHER PLACE</label>
              <input
                value={f.publisherPlace}
                onChange={(e) => setF({ ...f, publisherPlace: e.target.value })}
              />
            </div>
            <div className="field">
              <label>ACCESSED</label>
              <input
                type="date"
                value={f.accessedDate}
                onChange={(e) => setF({ ...f, accessedDate: e.target.value })}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>ISBN</label>
              <input
                value={f.isbn}
                onChange={(e) => setF({ ...f, isbn: e.target.value })}
              />
            </div>
            <div className="field">
              <label>ISSN</label>
              <input
                value={f.issn}
                onChange={(e) => setF({ ...f, issn: e.target.value })}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>DATE</label>
              <input
                type="date"
                value={f.date}
                onChange={(e) => setF({ ...f, date: e.target.value })}
              />
            </div>
            <div className="field">
              <label>SOURCE TYPE</label>
              <select
                value={f.type}
                onChange={(e) =>
                  setF({ ...f, type: e.target.value as SourceType })
                }
              >
                {sourceTypes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>URL *</label>
            <input
              required
              type="url"
              value={f.url}
              onChange={(e) => setF({ ...f, url: e.target.value })}
            />
          </div>
          <div className="field">
            <label>DOI</label>
            <input
              value={f.doi}
              onChange={(e) => setF({ ...f, doi: e.target.value })}
            />
          </div>
          <div className="field">
            <label>CONTAINER TITLE / JOURNAL</label>
            <input
              value={f.containerTitle}
              onChange={(e) => setF({ ...f, containerTitle: e.target.value })}
            />
          </div>
          <div className="form-row">
            <div className="field">
              <label>VOLUME</label>
              <input
                value={f.volume}
                onChange={(e) => setF({ ...f, volume: e.target.value })}
              />
            </div>
            <div className="field">
              <label>ISSUE</label>
              <input
                value={f.issue}
                onChange={(e) => setF({ ...f, issue: e.target.value })}
              />
            </div>
            <div className="field">
              <label>PAGES</label>
              <input
                value={f.pages}
                onChange={(e) => setF({ ...f, pages: e.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label>DESCRIPTION</label>
            <textarea
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
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
        className="modal"
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
          <h3>{initialAnnotation ? "Edit excerpt" : "New excerpt"}</h3>
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
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  return (
    <div className="modal-backdrop">
      <form
        className="modal"
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
          <h3>New project</h3>
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
