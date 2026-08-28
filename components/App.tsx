"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  BookmarkPlus,
  ChevronDown,
  ExternalLink,
  FileText,
  FolderOpen,
  Highlighter,
  Home,
  Library,
  LogOut,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Tag,
  Trash2,
  Copy,
  X,
} from "lucide-react";
import { Annotation, Project, Source, SourceType } from "@/lib/types";

const sourceTypes: SourceType[] = [
  "Article",
  "Report",
  "Case",
  "Bill",
  "Book",
  "Website",
];

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function citation(source: Source, style: string) {
  const author = source.authors || source.organization || "Unknown author";
  if (style === "MLA")
    return `${author}. “${source.title}.” ${source.organization || "Web"}, ${source.date}. ${source.url}`;
  if (style === "Chicago")
    return `${author}. “${source.title}.” ${source.organization || ""}. ${source.date}. ${source.url}.`;
  return `${author}. (${source.date || "n.d."}). ${source.title}. ${source.organization ? source.organization + ". " : ""}${source.url}`;
}

export default function App() {
  const [sources, setSources] = useState<Source[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [user, setUser] = useState({ name: "", email: "" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [accountMenu, setAccountMenu] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState("Dashboard");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<
    "source" | "annotation" | "project" | null
  >(null);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [toast, setToast] = useState("");
  const [sourceType, setSourceType] = useState<SourceType | "All">("All");

  useEffect(() => {
    async function loadWorkspace(initial = false) {
      try {
        const response = await fetch("/api/workspace", { cache: "no-store" });
        const data = await readJsonResponse(response);
        if (!response.ok)
          throw new Error(data.error ?? "Could not load your workspace");
        setSources(data.sources);
        setProjects(data.projects);
        setAnnotations(data.annotations);
        setUser(data.user);
        setLoadError("");
      } catch (error) {
        if (initial)
          setLoadError(
            error instanceof Error
              ? error.message
              : "Could not load your workspace",
          );
      } finally {
        if (initial) setLoading(false);
      }
    }
    loadWorkspace(true);
    const refresh = () => {
      if (document.visibilityState === "visible") loadWorkspace();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  useEffect(() => {
    const preferred =
      localStorage.getItem("rcm-theme") === "dark" ||
      (!localStorage.getItem("rcm-theme") &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDarkMode(preferred);
    document.documentElement.dataset.theme = preferred ? "dark" : "light";
  }, []);
  useEffect(() => {
    if (!accountMenu) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (!accountRef.current?.contains(event.target as Node))
        setAccountMenu(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setAccountMenu(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountMenu]);

  const filteredSources = useMemo(() => {
    const q = query.toLowerCase().trim();
    return sources.filter(
      (s) =>
        (sourceType === "All" || s.type === sourceType) &&
        (!q ||
          [s.title, s.authors, s.organization, s.description, ...s.tags]
            .join(" ")
            .toLowerCase()
            .includes(q)),
    );
  }, [sources, query, sourceType]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }
  async function deleteSource(id: string) {
    const response = await fetch(`/api/sources/${id}`, { method: "DELETE" });
    if (!response.ok) return notify("Could not delete source");
    setSources((prev) => prev.filter((s) => s.id !== id));
    setAnnotations((prev) => prev.filter((a) => a.sourceId !== id));
    notify("Source deleted");
  }
  function copyCitation(source: Source) {
    navigator.clipboard?.writeText(citation(source, "APA"));
    notify("APA citation copied");
  }

  if (loading)
    return (
      <div className="workspace-state">
        <div className="brand-mark">
          <BookOpen size={18} />
        </div>
        <div className="loading-line" />
        <p>Opening your research workspace…</p>
      </div>
    );
  if (loadError)
    return (
      <div className="workspace-state error-state">
        <h2>We couldn’t open your workspace.</h2>
        <p>{loadError}</p>
        <button className="btn" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <BookOpen size={18} />
          </div>
          <div>
            <h1>Marginalia</h1>
            <p>Research workspace</p>
          </div>
        </div>
        <nav className="nav">
          <div className="section-label">Workspace</div>
          <button
            className={view === "Dashboard" ? "active" : ""}
            onClick={() => setView("Dashboard")}
          >
            <Home size={16} />
            <span>Dashboard</span>
          </button>
          <button
            className={view === "Projects" ? "active" : ""}
            onClick={() => setView("Projects")}
          >
            <FolderOpen size={16} />
            <span>Projects</span>
          </button>
          <button
            className={view === "Sources" ? "active" : ""}
            onClick={() => setView("Sources")}
          >
            <Library size={16} />
            <span>Sources</span>
          </button>
          <button
            className={view === "Annotations" ? "active" : ""}
            onClick={() => setView("Annotations")}
          >
            <Highlighter size={16} />
            <span>Annotations</span>
          </button>
          <div className="section-label">Manage</div>
          <button
            className={view === "Tags" ? "active" : ""}
            onClick={() => setView("Tags")}
          >
            <Tag size={16} />
            <span>Tags</span>
          </button>
          <button
            className={view === "Settings" ? "active" : ""}
            onClick={() => setView("Settings")}
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>
        </nav>
        <div className="sidebar-capture">
          <div className="capture-icon">
            <BookmarkPlus size={17} />
          </div>
          <strong>Capture as you browse</strong>
          <p>Save any webpage with the Chrome extension.</p>
          <button onClick={() => notify("Extension setup is coming next")}>
            Extension setup <ArrowRight size={13} />
          </button>
        </div>
        <div className="sidebar-footer">
          <span className="status-dot" /> Demo workspace
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="search">
            <Search size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setView("Sources")}
              aria-label="Search your research"
            />
            <kbd>⌘ K</kbd>
          </div>
          <div className="topbar-actions">
            <button className="btn primary" onClick={() => setModal("project")}>
              <Plus size={16} /> Create project
            </button>
            <div className="account" ref={accountRef}>
              <button
                className={`profile ${accountMenu ? "open" : ""}`}
                aria-label="Open account menu"
                aria-expanded={accountMenu}
                onClick={() => setAccountMenu((value) => !value)}
              >
                <span>{initials(user.name || user.email)}</span>
                <div>
                  <strong>{user.name || user.email}</strong>
                  <small>Personal workspace</small>
                </div>
                <ChevronDown size={14} />
              </button>
              {accountMenu && (
                <div className="account-menu">
                  <div className="account-menu-user">
                    <strong>{user.name || "Researcher"}</strong>
                    <span>{user.email}</span>
                  </div>
                  <button
                    onClick={() => {
                      const next = !darkMode;
                      setDarkMode(next);
                      document.documentElement.dataset.theme = next
                        ? "dark"
                        : "light";
                      localStorage.setItem(
                        "rcm-theme",
                        next ? "dark" : "light",
                      );
                    }}
                  >
                    <span>
                      {darkMode ? <Sun size={15} /> : <Moon size={15} />}Dark
                      mode
                    </span>
                    <span className={`toggle ${darkMode ? "on" : ""}`}>
                      <i />
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setView("Settings");
                      setAccountMenu(false);
                    }}
                  >
                    <span>
                      <Settings size={15} />
                      Settings
                    </span>
                  </button>
                  <div className="menu-separator" />
                  <form action="/auth/signout" method="post">
                    <button className="logout">
                      <span>
                        <LogOut size={15} />
                        Log out
                      </span>
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="content">
          {view === "Dashboard" && (
            <Dashboard
              userName={user.name}
              sources={sources}
              projects={projects}
              annotations={annotations}
              onSource={setSelectedSource}
              onAddSource={() => setModal("source")}
              onNavigate={setView}
            />
          )}
          {view === "Sources" && (
            <SourcesView
              sources={filteredSources}
              activeType={sourceType}
              onType={setSourceType}
              onSource={setSelectedSource}
              onDelete={deleteSource}
              onCopy={copyCitation}
              onAdd={() => setModal("source")}
            />
          )}
          {view === "Annotations" && (
            <AnnotationsView
              annotations={annotations}
              sources={sources}
              onAdd={() => setModal("annotation")}
            />
          )}
          {view === "Projects" && (
            <ProjectsView
              projects={projects}
              sources={sources}
              annotations={annotations}
              onAdd={() => setModal("project")}
            />
          )}
          {view === "Tags" && (
            <TagsView sources={sources} annotations={annotations} />
          )}
          {view === "Settings" && (
            <SettingsView
              user={user}
              darkMode={darkMode}
              onTheme={() => {
                const next = !darkMode;
                setDarkMode(next);
                document.documentElement.dataset.theme = next
                  ? "dark"
                  : "light";
                localStorage.setItem("rcm-theme", next ? "dark" : "light");
              }}
            />
          )}
        </div>
      </main>

      {selectedSource && (
        <SourceDetail
          source={selectedSource}
          annotations={annotations.filter(
            (a) => a.sourceId === selectedSource.id,
          )}
          onClose={() => setSelectedSource(null)}
          onCopy={() => copyCitation(selectedSource)}
        />
      )}
      {modal === "source" && (
        <SourceModal
          projects={projects}
          onCreateProject={async (name) => {
            const saved = await postJson<Project>("/api/projects", {
              name,
              description: "",
            });
            setProjects((prev) => [saved, ...prev]);
            notify("Project created");
            return saved;
          }}
          onClose={() => setModal(null)}
          onSave={async (s) => {
            try {
              const saved = await postJson<Source>("/api/sources", s);
              setSources((prev) => [saved, ...prev]);
              setModal(null);
              notify("Source saved");
            } catch (error) {
              notify(
                error instanceof Error
                  ? error.message
                  : "Could not save source",
              );
            }
          }}
        />
      )}
      {modal === "annotation" && (
        <AnnotationModal
          sources={sources}
          projects={projects}
          onClose={() => setModal(null)}
          onSave={async (a) => {
            try {
              const source = sources.find((item) => item.id === a.sourceId);
              const saved = await postJson<Annotation>("/api/annotations", {
                ...a,
                pageUrl: source?.url,
                locationData: a.pageNumber
                  ? { pageNumber: a.pageNumber }
                  : undefined,
              });
              setAnnotations((prev) => [saved, ...prev]);
              setModal(null);
              notify("Annotation saved");
            } catch (error) {
              notify(
                error instanceof Error
                  ? error.message
                  : "Could not save annotation",
              );
            }
          }}
        />
      )}
      {modal === "project" && (
        <ProjectModal
          onClose={() => setModal(null)}
          onSave={async (p) => {
            try {
              const saved = await postJson<Project>("/api/projects", p);
              setProjects((prev) => [saved, ...prev]);
              setModal(null);
              notify("Project created");
            } catch (error) {
              notify(
                error instanceof Error
                  ? error.message
                  : "Could not create project",
              );
            }
          }}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function initials(value: string) {
  return value
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
async function readJsonResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      `The server returned an unexpected ${response.status} response. Check the development server for the underlying error.`,
    );
  }
  return response.json();
}
async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

function Dashboard({
  userName,
  sources,
  projects,
  annotations,
  onSource,
  onAddSource,
  onNavigate,
}: {
  userName: string;
  sources: Source[];
  projects: Project[];
  annotations: Annotation[];
  onSource: (s: Source) => void;
  onAddSource: () => void;
  onNavigate: (view: string) => void;
}) {
  return (
    <>
      <div className="page-title hero-title">
        <div>
          <div className="eyebrow">
            <span className="status-dot" /> Your research workspace
          </div>
          <h2>Welcome back{userName ? `, ${userName.split(" ")[0]}` : ""}.</h2>
          <p>
            Pick up where you left off, or capture something new for your
            research.
          </p>
        </div>
        <button className="btn primary" onClick={onAddSource}>
          <BookmarkPlus size={16} /> Save a source
        </button>
      </div>
      <div className="dashboard-priority">
        <section className="card featured-projects">
          <div className="card-header">
            <div className="section-heading">
              <span className="section-heading-icon">
                <FolderOpen size={15} />
              </span>
              <div>
                <h3>Active projects</h3>
                <p>Your research in progress · {projects.length} active</p>
              </div>
            </div>
            <button
              className="text-button"
              onClick={() => onNavigate("Projects")}
            >
              View all projects <ArrowRight size={14} />
            </button>
          </div>
          <div className="project-showcase">
            {projects.map((p, index) => (
              <button
                className="project project-feature"
                key={p.id}
                onClick={() => onNavigate("Projects")}
              >
                <span className={`project-mark mark-${index + 1}`}>
                  <FolderOpen size={17} />
                </span>
                <span>
                  <strong>{p.name}</strong>
                  <small>{p.description || "Research workspace"}</small>
                  <span className="project-counts">
                    {sources.filter((s) => s.projects.includes(p.id)).length}{" "}
                    sources ·{" "}
                    {
                      annotations.filter((a) => a.projects.includes(p.id))
                        .length
                    }{" "}
                    annotations
                  </span>
                </span>
                <ArrowRight size={14} />
              </button>
            ))}
          </div>
        </section>
        <div className="dashboard-secondary">
          <section className="card">
            <div className="card-header">
              <div className="section-heading">
                <span className="section-heading-icon">
                  <BookmarkPlus size={15} />
                </span>
                <div>
                  <h3>Recently saved</h3>
                  <p>Your latest additions</p>
                </div>
              </div>
              <button
                className="text-button"
                onClick={() => onNavigate("Sources")}
              >
                View library <ArrowRight size={14} />
              </button>
            </div>
            {sources.slice(0, 4).map((s) => (
              <button
                className="source-row"
                key={s.id}
                onClick={() => onSource(s)}
              >
                <div className="source-type-icon">
                  <FileText size={17} />
                </div>
                <div>
                  <div className="source-title">{s.title}</div>
                  <div className="source-meta">
                    {s.organization || s.authors} · {s.date}
                  </div>
                  <div>
                    {s.tags.slice(0, 2).map((t) => (
                      <span className="pill" key={t}>
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="source-kind">{s.type}</span>
              </button>
            ))}
          </section>
          <section className="card">
            <div className="card-header">
              <div className="section-heading">
                <span className="section-heading-icon">
                  <Highlighter size={15} />
                </span>
                <div>
                  <h3>Recent annotations</h3>
                  <p>Your latest evidence and notes</p>
                </div>
              </div>
              <button
                className="text-button"
                onClick={() => onNavigate("Annotations")}
              >
                View annotations <ArrowRight size={14} />
              </button>
            </div>
            {annotations.slice(0, 4).map((a) => (
              <div className="annotation dashboard-annotation" key={a.id}>
                <div className="quote">{a.selectedText}</div>
                <div className="note">
                  {a.note || "No note added"} ·{" "}
                  {sources.find((s) => s.id === a.sourceId)?.title}
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}

function SourcesView({
  sources,
  activeType,
  onType,
  onSource,
  onDelete,
  onCopy,
  onAdd,
}: {
  sources: Source[];
  activeType: SourceType | "All";
  onType: (type: SourceType | "All") => void;
  onSource: (s: Source) => void;
  onDelete: (id: string) => void;
  onCopy: (s: Source) => void;
  onAdd: () => void;
}) {
  return (
    <>
      <div className="page-title">
        <div>
          <div className="kicker">Research library</div>
          <h2>All sources</h2>
          <p>Review, organize, and cite everything you have collected.</p>
        </div>
        <button className="btn primary" onClick={onAdd}>
          <Plus size={16} /> Add source
        </button>
      </div>
      <div className="toolbar">
        {(["All", ...sourceTypes] as const).map((t) => (
          <button
            className={`filter ${activeType === t ? "active" : ""}`}
            onClick={() => onType(t)}
            key={t}
          >
            {t}
            {t === "All" && <span>{sources.length}</span>}
          </button>
        ))}
      </div>
      {sources.length ? (
        sources.map((s) => (
          <div className="card source-card" key={s.id}>
            <button className="source-card-main" onClick={() => onSource(s)}>
              <span className="source-type-icon">
                <FileText size={18} />
              </span>
              <span>
                <span className="source-kind">{s.type}</span>
                <h3>{s.title}</h3>
                <span className="source-meta">
                  {s.authors} · {s.organization} · {s.date}
                </span>
                <span className="desc">{s.description}</span>
                {s.tags.map((t) => (
                  <span className="pill" key={t}>
                    #{t}
                  </span>
                ))}
              </span>
            </button>
            <div className="source-actions">
              <button
                className="icon-btn"
                title="Copy APA citation"
                onClick={() => onCopy(s)}
              >
                <Copy size={15} />
              </button>
              <a
                className="icon-btn"
                href={s.url}
                target="_blank"
                rel="noreferrer"
                title="Open original"
              >
                <ExternalLink size={15} />
              </a>
              <button
                className="icon-btn danger"
                title="Delete"
                onClick={() => onDelete(s.id)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))
      ) : (
        <div className="card empty">
          <Search size={24} />
          <h3>No sources found</h3>
          <p>Try a different search or filter, or add a new source.</p>
          <button className="btn primary" onClick={onAdd}>
            <Plus size={15} /> Add source
          </button>
        </div>
      )}
    </>
  );
}

function AnnotationsView({
  annotations,
  sources,
  onAdd,
}: {
  annotations: Annotation[];
  sources: Source[];
  onAdd: () => void;
}) {
  return (
    <>
      <div className="page-title">
        <div>
          <div className="kicker">Evidence library</div>
          <h2>Annotations</h2>
          <p>
            Passages, evidence, questions, and notes captured from your
            research.
          </p>
        </div>
        <button className="btn primary" onClick={onAdd}>
          <Plus size={16} /> New annotation
        </button>
      </div>
      <div className="card">
        {annotations.map((a) => (
          <div className="annotation" key={a.id}>
            <div className="annotation-top">
              <span className="annotation-type">
                <Highlighter size={12} />
                {a.type}
              </span>
              <span className="source-meta">
                {sources.find((s) => s.id === a.sourceId)?.title}
              </span>
            </div>
            <div className="quote">{a.selectedText}</div>
            <div className="note">{a.note}</div>
            <div>
              {a.tags.map((t) => (
                <span className="pill" key={t}>
                  #{t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ProjectsView({
  projects,
  sources,
  annotations,
  onAdd,
}: {
  projects: Project[];
  sources: Source[];
  annotations: Annotation[];
  onAdd: () => void;
}) {
  return (
    <>
      <div className="page-title">
        <div>
          <div className="kicker">Workspaces</div>
          <h2>Projects</h2>
          <p>
            Research collections that connect sources, annotations, and future
            writing.
          </p>
        </div>
        <button className="btn primary" onClick={onAdd}>
          <Plus size={16} /> New project
        </button>
      </div>
      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}
      >
        {projects.map((p) => (
          <div className="card" key={p.id}>
            <div className="kicker">Project</div>
            <h3 style={{ margin: "8px 0 6px" }}>{p.name}</h3>
            <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
              {p.description}
            </p>
            <div style={{ marginTop: 15 }}>
              <span className="pill green">
                {sources.filter((s) => s.projects.includes(p.id)).length}{" "}
                sources
              </span>
              <span className="pill">
                {annotations.filter((a) => a.projects.includes(p.id)).length}{" "}
                annotations
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function TagsView({
  sources,
  annotations,
}: {
  sources: Source[];
  annotations: Annotation[];
}) {
  const tags = new Map<string, number>();
  sources
    .flatMap((s) => s.tags)
    .forEach((t) => tags.set(t, (tags.get(t) || 0) + 1));
  annotations
    .flatMap((a) => a.tags)
    .forEach((t) => tags.set(t, (tags.get(t) || 0) + 1));
  return (
    <>
      <div className="page-title">
        <div>
          <div className="kicker">Organization</div>
          <h2>Tags</h2>
          <p>A lightweight taxonomy for finding evidence by topic.</p>
        </div>
      </div>
      <div className="card">
        {[...tags.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([t, n]) => (
            <span className="pill" key={t} style={{ padding: "8px 11px" }}>
              #{t} · {n}
            </span>
          ))}
      </div>
    </>
  );
}

function SettingsView({
  user,
  darkMode,
  onTheme,
}: {
  user: { name: string; email: string };
  darkMode: boolean;
  onTheme: () => void;
}) {
  return (
    <>
      <div className="page-title">
        <div>
          <div className="kicker">Account</div>
          <h2>Settings</h2>
          <p>Manage your workspace preferences and account information.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="card settings-card">
          <div>
            <h3>Profile</h3>
            <p>Your identity is managed securely through Supabase Auth.</p>
          </div>
          <div className="settings-profile">
            <span>{initials(user.name || user.email)}</span>
            <div>
              <strong>{user.name || "Researcher"}</strong>
              <small>{user.email}</small>
            </div>
          </div>
        </section>
        <section className="card settings-card">
          <div>
            <h3>Appearance</h3>
            <p>Choose how Marginalia looks on this device.</p>
          </div>
          <button className="setting-row" onClick={onTheme}>
            <span className="setting-icon">
              {darkMode ? <Moon size={17} /> : <Sun size={17} />}
            </span>
            <span>
              <strong>Dark mode</strong>
              <small>
                {darkMode
                  ? "Dark appearance is enabled"
                  : "Light appearance is enabled"}
              </small>
            </span>
            <span className={`toggle ${darkMode ? "on" : ""}`}>
              <i />
            </span>
          </button>
        </section>
      </div>
    </>
  );
}

function SourceDetail({
  source,
  annotations,
  onClose,
  onCopy,
}: {
  source: Source;
  annotations: Annotation[];
  onClose: () => void;
  onCopy: () => void;
}) {
  const [style, setStyle] = useState("APA");
  const [copied, setCopied] = useState(false);
  const text = citation(source, style);
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="card-header">
          <div>
            <div className="kicker">{source.type}</div>
            <h3 style={{ marginTop: 6 }}>{source.title}</h3>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="detail-grid">
          <div>
            <div className="source-meta">
              {source.authors} · {source.organization} · {source.date}
            </div>
            <p style={{ lineHeight: 1.6, fontSize: 14 }}>
              {source.description}
            </p>
            <div>
              {source.tags.map((t) => (
                <span className="pill" key={t}>
                  #{t}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 25 }}>
              <div className="card-header">
                <h3>Annotations ({annotations.length})</h3>
              </div>
              {annotations.length ? (
                annotations.map((a) => (
                  <div className="annotation" key={a.id}>
                    <div className="quote">{a.selectedText}</div>
                    <div className="note">{a.note}</div>
                  </div>
                ))
              ) : (
                <div className="empty">No annotations yet.</div>
              )}
            </div>
          </div>
          <aside>
            <div className="field">
              <label>CITATION STYLE</label>
              <select value={style} onChange={(e) => setStyle(e.target.value)}>
                <option>APA</option>
                <option>MLA</option>
                <option>Chicago</option>
              </select>
            </div>
            <div style={{ marginTop: 10 }} className="citation">
              {text}
            </div>
            <button
              className="btn primary"
              style={{ width: "100%", justifyContent: "center", marginTop: 9 }}
              onClick={() => {
                navigator.clipboard?.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
            >
              {copied ? "Copied" : "Copy citation"}
            </button>
            <a
              className="btn"
              style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
              href={source.url}
              target="_blank"
              rel="noreferrer"
            >
              Open original <ExternalLink size={14} />
            </a>
          </aside>
        </div>
      </div>
    </div>
  );
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

function SourceModal({
  projects,
  onCreateProject,
  onClose,
  onSave,
}: {
  projects: Project[];
  onCreateProject: (name: string) => Promise<Project>;
  onClose: () => void;
  onSave: (s: Source) => void | Promise<void>;
}) {
  const [f, setF] = useState({
    title: "",
    authors: "",
    organization: "",
    date: "",
    url: "",
    type: "Article" as SourceType,
    description: "",
    tags: "",
    project: projects[0]?.id || "",
    notes: "",
  });
  const [tags, setTags] = useState<string[]>([]);
  const [newProject, setNewProject] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title || !f.url) return;
    onSave({
      id: uid("s"),
      title: f.title,
      authors: f.authors
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean)
        .join(", "),
      organization: f.organization,
      date: f.date,
      url: f.url,
      type: f.type,
      description: f.description,
      tags,
      projects: f.project ? [f.project] : [],
      notes: f.notes,
      createdAt: new Date().toISOString().slice(0, 10),
    });
  }
  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={submit}>
        <div className="card-header">
          <h3>Add source</h3>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
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

function AnnotationModal({
  sources,
  projects,
  onClose,
  onSave,
}: {
  sources: Source[];
  projects: Project[];
  onClose: () => void;
  onSave: (a: Annotation) => void | Promise<void>;
}) {
  const [f, setF] = useState({
    sourceId: sources[0]?.id || "",
    selectedText: "",
    note: "",
    pageNumber: "",
    project: projects[0]?.id || "",
    type: "Quote" as Annotation["type"],
  });
  const [tags, setTags] = useState<string[]>([]);
  return (
    <div className="modal-backdrop">
      <form
        className="modal"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            id: uid("a"),
            sourceId: f.sourceId,
            selectedText: f.selectedText,
            note: f.note,
            tags,
            projects: f.project ? [f.project] : [],
            type: f.type,
            pageNumber: f.pageNumber || undefined,
            createdAt: new Date().toISOString().slice(0, 10),
          });
        }}
      >
        <div className="card-header">
          <h3>New annotation</h3>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>SOURCE</label>
            <select
              value={f.sourceId}
              onChange={(e) => setF({ ...f, sourceId: e.target.value })}
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
                  "Quote",
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
          <button className="btn primary">Save annotation</button>
        </div>
      </form>
    </div>
  );
}

function ProjectModal({
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
          if (name) onSave({ id: uid("p"), name, description });
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
