"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BookmarkPlus,
  ChevronDown,
  ExternalLink,
  FileText,
  Filter,
  FolderOpen,
  Highlighter,
  Home,
  Library,
  Layers3,
  Link2,
  LogOut,
  MoreHorizontal,
  Moon,
  Pencil,
  Plus,
  Search,
  Settings,
  Sun,
  Tag,
  Trash2,
  RotateCcw,
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

const walkthroughSteps = [
  {
    view: "Dashboard",
    eyebrow: "Your home base",
    title: "See your research at a glance",
    description: "The dashboard keeps active projects, recent sources, and your newest excerpts close at hand.",
  },
  {
    view: "Projects",
    eyebrow: "Projects",
    title: "Organize work by question or assignment",
    description: "Create a project, open it to see every connected source, or archive it when the work is complete.",
  },
  {
    view: "Sources",
    eyebrow: "Sources",
    title: "Build a reliable source library",
    description: "Save a URL for automatic citation details, enter one manually, then filter and sort your library as it grows.",
  },
  {
    view: "Annotations",
    eyebrow: "Excerpts",
    title: "Keep evidence connected to context",
    description: "Every highlighted passage lives with its source, project, note, page number, and reusable tags.",
  },
  {
    view: "Tags",
    eyebrow: "Tags",
    title: "Follow ideas across your research",
    description: "Select a tag to reveal all related sources and excerpts, even when they belong to different projects.",
  },
  {
    view: "Archived",
    eyebrow: "Archive",
    title: "Clear the workspace without losing work",
    description: "Archived projects stay preserved here and can be restored whenever you need them again.",
  },
  {
    view: "Dashboard",
    eyebrow: "Universal search",
    title: "Find anything from one place",
    description: "Use the search bar—or press ⌘ K—to find projects, sources, and tags without changing sections first.",
  },
  {
    view: "Dashboard",
    eyebrow: "Chrome extension · Save",
    title: "Capture a source while you browse",
    description: "Open the Marginalia extension on an article, review the detected citation details, choose a project, add tags, and save.",
    extension: "source",
  },
  {
    view: "Dashboard",
    eyebrow: "Chrome extension · Excerpt",
    title: "Turn a highlight into usable evidence",
    description: "After saving a source, highlight text on the page. Add a note, tags, and an optional page number in the popup, then save the excerpt.",
    extension: "excerpt",
  },
  {
    view: "Settings",
    eyebrow: "You’re ready",
    title: "Make Marginalia your own",
    description: "Adjust appearance here and restart this walkthrough at any time. Your workspace is ready for the next research question.",
  },
] as const;

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

const THEME_EVENT = "marginalia-theme-change";

function subscribeToTheme(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const notifySystemThemeChange = () => {
    if (!localStorage.getItem("rcm-theme")) onChange();
  };
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange);
  media.addEventListener("change", notifySystemThemeChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
    media.removeEventListener("change", notifySystemThemeChange);
  };
}

function getThemeSnapshot() {
  const saved = localStorage.getItem("rcm-theme");
  return saved
    ? saved === "dark"
    : window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function useDarkMode() {
  return useSyncExternalStore(subscribeToTheme, getThemeSnapshot, () => false);
}

function setTheme(dark: boolean) {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  localStorage.setItem("rcm-theme", dark ? "dark" : "light");
  window.dispatchEvent(new Event(THEME_EVENT));
}

export default function App() {
  const [sources, setSources] = useState<Source[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [user, setUser] = useState({ name: "", email: "" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [accountMenu, setAccountMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const darkMode = useDarkMode();
  const accountRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState("Dashboard");
  const [query, setQuery] = useState("");
  const [searchedTag, setSearchedTag] = useState<string | null>(null);
  const [modal, setModal] = useState<
    "source" | "annotation" | "project" | null
  >(null);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(
    null,
  );
  const [annotationDefaults, setAnnotationDefaults] = useState<{
    sourceId?: string;
    projectId?: string;
  }>({});
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [projectBackView, setProjectBackView] = useState("Projects");
  const [sourceBackView, setSourceBackView] = useState("Sources");
  const [toast, setToast] = useState("");
  const [sourceType, setSourceType] = useState<SourceType | "All">("All");
  const [walkthroughStep, setWalkthroughStep] = useState<number | null>(null);

  useEffect(() => {
    async function loadWorkspace(initial = false) {
      try {
        const response = await fetch("/api/workspace", { cache: "no-store" });
        const data = await readJsonResponse(response);
        if (!response.ok)
          throw new Error(data.error ?? "Could not load your workspace");
        setSources(data.sources);
        setProjects(data.projects);
        setAnnotations(data.excerpts);
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
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
  }, [darkMode]);
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

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!searchRef.current?.contains(event.target as Node))
        setSearchOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        searchInputRef.current?.blur();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const searchResults = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return { sources: [], projects: [], tags: [] };
    const tags = [
      ...new Set([
        ...sources.flatMap((source) => source.tags),
        ...annotations.flatMap((excerpt) => excerpt.tags),
      ]),
    ];
    return {
      sources: sources
        .filter((source) =>
          [
            source.title,
            source.authors,
            source.organization,
            source.description,
            source.bibliographyAnnotation,
            ...source.tags,
          ]
            .join(" ")
            .toLowerCase()
            .includes(value),
        )
        .slice(0, 5),
      projects: projects
        .filter(
          (project) =>
            !project.deletedAt &&
            [project.name, project.description]
              .join(" ")
              .toLowerCase()
              .includes(value),
        )
        .slice(0, 5),
      tags: tags
        .filter((tag) => tag.toLowerCase().includes(value))
        .sort()
        .slice(0, 8),
    };
  }, [annotations, projects, query, sources]);

  function finishSearch() {
    setQuery("");
    setSearchOpen(false);
    searchInputRef.current?.blur();
  }

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }
  function navigate(nextView: string) {
    setSelectedSource(null);
    if (nextView !== "Project") setSelectedProject(null);
    setView(nextView);
  }
  function goToWalkthroughStep(index: number) {
    const step = walkthroughSteps[index];
    if (!step) {
      setWalkthroughStep(null);
      return;
    }
    navigate(step.view);
    setWalkthroughStep(index);
  }
  function openProject(project: Project) {
    setProjectBackView(view);
    setSelectedProject(project);
    setSelectedSource(null);
    setView("Project");
  }
  function openSource(source: Source) {
    setSourceBackView(view);
    setSelectedSource(source);
    setView("Source");
  }
  async function deleteSource(id: string) {
    const response = await fetch(`/api/sources/${id}`, { method: "DELETE" });
    if (!response.ok) return notify("Could not delete source");
    setSources((prev) => prev.filter((s) => s.id !== id));
    setAnnotations((prev) => prev.filter((a) => a.sourceId !== id));
    notify("Source deleted");
  }
  async function updateProjectState(
    project: Project,
    action: "unarchive" | "archive",
  ) {
    const response = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await readJsonResponse(response);
    if (!response.ok)
      return notify(data.error ?? "Could not update the project");
    setProjects((current) =>
      current.map((item) => (item.id === data.id ? data : item)),
    );
    if (selectedProject?.id === data.id) setSelectedProject(data);
    notify(action === "unarchive" ? "Project unarchived" : "Project archived");
  }
  async function permanentlyDeleteProject(project: Project) {
    const response = await fetch(`/api/projects/${project.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const data = await readJsonResponse(response);
      return notify(data.error ?? "Could not permanently delete the project");
    }
    setProjects((current) => current.filter((item) => item.id !== project.id));
    setProjectToDelete(null);
    if (selectedProject?.id === project.id) navigate(projectBackView);
    notify("Project permanently deleted");
  }
  function copyCitation(source: Source) {
    navigator.clipboard?.writeText(citation(source, "APA"));
    notify("APA citation copied");
  }
  function copyAnnotation(annotation: Annotation) {
    navigator.clipboard?.writeText(annotation.selectedText);
    notify("Excerpt copied");
  }
  async function updateBibliographyAnnotation(
    source: Source,
    bibliographyAnnotation: string,
    includeInBibliography: boolean,
  ) {
    const response = await fetch(`/api/sources/${source.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "updateBibliographyAnnotation",
        bibliographyAnnotation,
        includeInBibliography,
      }),
    });
    const saved = await readJsonResponse(response);
    if (!response.ok)
      throw new Error(saved.error ?? "Could not update annotation");
    setSources((current) =>
      current.map((item) => (item.id === saved.id ? saved : item)),
    );
    if (selectedSource?.id === saved.id) setSelectedSource(saved);
    return saved as Source;
  }
  async function deleteAnnotation(annotation: Annotation) {
    if (!window.confirm("Delete this excerpt? This cannot be undone.")) return;
    const response = await fetch(`/api/excerpts/${annotation.id}`, {
      method: "DELETE",
    });
    if (!response.ok) return notify("Could not delete excerpt");
    setAnnotations((current) =>
      current.filter((item) => item.id !== annotation.id),
    );
    if (editingAnnotation?.id === annotation.id) setEditingAnnotation(null);
    notify("Excerpt deleted");
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
          </div>
        </div>
        <nav className="nav">
          <div className="section-label">Workspace</div>
          <button
            className={view === "Dashboard" ? "active" : ""}
            onClick={() => navigate("Dashboard")}
          >
            <Home size={16} />
            <span>Dashboard</span>
          </button>
          <button
            className={
              view === "Projects" ||
              (view === "Project" && projectBackView !== "Archived")
                ? "active"
                : ""
            }
            onClick={() => navigate("Projects")}
          >
            <FolderOpen size={16} />
            <span>Projects</span>
          </button>
          <button
            className={view === "Sources" || view === "Source" ? "active" : ""}
            onClick={() => navigate("Sources")}
          >
            <Library size={16} />
            <span>Sources</span>
          </button>
          <button
            className={view === "Annotations" ? "active" : ""}
            onClick={() => navigate("Annotations")}
          >
            <Highlighter size={16} />
            <span>Excerpts</span>
          </button>
          <div className="section-label">Manage</div>
          <button
            className={view === "Tags" ? "active" : ""}
            onClick={() => navigate("Tags")}
          >
            <Tag size={16} />
            <span>Tags</span>
          </button>
          <button
            className={
              view === "Archived" ||
              (view === "Project" && projectBackView === "Archived")
                ? "active"
                : ""
            }
            onClick={() => navigate("Archived")}
          >
            <Archive size={16} />
            <span>Archived</span>
          </button>
          <button
            className={view === "Settings" ? "active" : ""}
            onClick={() => navigate("Settings")}
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
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="search" ref={searchRef}>
            <Search size={16} />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              aria-label="Search projects, sources, and tags"
            />
            <kbd>⌘ K</kbd>
            {searchOpen && query.trim() && (
              <UniversalSearchResults
                results={searchResults}
                onSource={(source) => {
                  openSource(source);
                  finishSearch();
                }}
                onProject={(project) => {
                  openProject(project);
                  finishSearch();
                }}
                onTag={(tag) => {
                  setSearchedTag(tag);
                  navigate("Tags");
                  finishSearch();
                }}
              />
            )}
          </div>
          <div className="topbar-actions">
            <button className="btn primary" onClick={() => setModal("source")}>
              <BookmarkPlus size={16} /> Save a source
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
                      setTheme(next);
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
                      navigate("Settings");
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
              onSource={openSource}
              onProject={openProject}
              onAddProject={() => setModal("project")}
              onNavigate={navigate}
            />
          )}
          {view === "Sources" && (
            <SourcesView
              sources={sources}
              projects={projects}
              activeType={sourceType}
              onType={setSourceType}
              onSource={openSource}
              onDelete={deleteSource}
              onCopy={copyCitation}
              onEdit={setEditingSource}
              onAdd={() => setModal("source")}
            />
          )}
          {view === "Annotations" && (
            <AnnotationsView
              annotations={annotations}
              sources={sources}
              projects={projects}
              onSource={openSource}
              onCopy={copyAnnotation}
              onEdit={setEditingAnnotation}
              onDelete={deleteAnnotation}
              onAdd={() => {
                setAnnotationDefaults({});
                setModal("annotation");
              }}
            />
          )}
          {view === "Projects" && (
            <ProjectsView
              projects={projects}
              sources={sources}
              annotations={annotations}
              onAdd={() => setModal("project")}
              onProject={openProject}
              onState={updateProjectState}
              onRequestDelete={setProjectToDelete}
            />
          )}
          {view === "Project" && selectedProject && (
            <ProjectDetail
              project={selectedProject}
              sources={sources.filter((source) =>
                source.projects.includes(selectedProject.id),
              )}
              annotations={annotations}
              onBack={() => navigate(projectBackView)}
              onSource={openSource}
              onAddSource={() => setModal("source")}
              onState={updateProjectState}
              onRequestDelete={setProjectToDelete}
            />
          )}
          {view === "Source" && selectedSource && (
            <SourceDetail
              key={selectedSource.id}
              source={selectedSource}
              annotations={annotations.filter(
                (annotation) => annotation.sourceId === selectedSource.id,
              )}
              onEdit={() => setEditingSource(selectedSource)}
              onSaveBibliography={async (bibliographyAnnotation, include) => {
                try {
                  await updateBibliographyAnnotation(
                    selectedSource,
                    bibliographyAnnotation,
                    include,
                  );
                  notify("Bibliography annotation saved");
                } catch (error) {
                  notify(
                    error instanceof Error
                      ? error.message
                      : "Could not save annotation",
                  );
                  throw error;
                }
              }}
              onToggleBibliography={async (include) => {
                try {
                  await updateBibliographyAnnotation(
                    selectedSource,
                    selectedSource.bibliographyAnnotation || "",
                    include,
                  );
                  notify(
                    include
                      ? "Included in bibliography"
                      : "Excluded from bibliography",
                  );
                } catch (error) {
                  notify(
                    error instanceof Error
                      ? error.message
                      : "Could not update bibliography",
                  );
                }
              }}
              onCopyAnnotation={copyAnnotation}
              onEditAnnotation={setEditingAnnotation}
              onDeleteAnnotation={deleteAnnotation}
              onAddAnnotation={() => {
                setAnnotationDefaults({
                  sourceId: selectedSource.id,
                  projectId: selectedSource.projects[0],
                });
                setModal("annotation");
              }}
              onBack={() => {
                setSelectedSource(null);
                setView(sourceBackView);
              }}
            />
          )}
          {view === "Tags" && (
            <TagsView
              key={searchedTag ?? "all-tags"}
              sources={sources}
              annotations={annotations}
              initialTag={searchedTag}
              onSource={openSource}
            />
          )}
          {view === "Archived" && (
            <ArchivedProjectsView
              projects={projects.filter(
                (project) => !project.deletedAt && !project.isActive,
              )}
              sources={sources}
              annotations={annotations}
              onProject={openProject}
              onState={updateProjectState}
              onRequestDelete={setProjectToDelete}
            />
          )}
          {view === "Settings" && (
            <SettingsView
              user={user}
              darkMode={darkMode}
              onTheme={() => {
                const next = !darkMode;
                setTheme(next);
              }}
              onStartWalkthrough={() => goToWalkthroughStep(0)}
            />
          )}
        </div>
      </main>

      {projectToDelete && (
        <ProjectDeleteModal
          project={projectToDelete}
          onClose={() => setProjectToDelete(null)}
          onConfirm={() => permanentlyDeleteProject(projectToDelete)}
        />
      )}

      {editingSource && (
        <SourceModal
          projects={projects.filter((project) => !project.deletedAt)}
          initialSource={editingSource}
          onCreateProject={async (name) => {
            const saved = await postJson<Project>("/api/projects", {
              name,
              description: "",
            });
            setProjects((prev) => [saved, ...prev]);
            notify("Project created");
            return saved;
          }}
          onClose={() => setEditingSource(null)}
          onSave={async (source) => {
            try {
              const response = await fetch(`/api/sources/${editingSource.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(source),
              });
              const saved = await readJsonResponse(response);
              if (!response.ok)
                throw new Error(saved.error ?? "Could not update source");
              setSources((current) =>
                current.map((item) => (item.id === saved.id ? saved : item)),
              );
              setAnnotations((current) =>
                current.map((annotation) =>
                  annotation.sourceId === saved.id
                    ? { ...annotation, projects: saved.projects }
                    : annotation,
                ),
              );
              setSelectedSource(saved);
              setEditingSource(null);
              notify("Source updated");
            } catch (error) {
              notify(
                error instanceof Error
                  ? error.message
                  : "Could not update source",
              );
            }
          }}
        />
      )}

      {modal === "source" && (
        <SourceModal
          projects={projects.filter((project) => !project.deletedAt)}
          initialProjectId={
            view === "Project" ? selectedProject?.id : undefined
          }
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
          projects={projects.filter((project) => !project.deletedAt)}
          initialSourceId={annotationDefaults.sourceId}
          initialProjectId={annotationDefaults.projectId}
          onClose={() => setModal(null)}
          onSave={async (a) => {
            try {
              const source = sources.find((item) => item.id === a.sourceId);
              const saved = await postJson<Annotation>("/api/excerpts", {
                ...a,
                pageUrl: source?.url,
                locationData: a.pageNumber
                  ? { pageNumber: a.pageNumber }
                  : undefined,
              });
              setAnnotations((prev) => [saved, ...prev]);
              setModal(null);
              notify("Excerpt saved");
            } catch (error) {
              notify(
                error instanceof Error
                  ? error.message
                  : "Could not save excerpt",
              );
            }
          }}
        />
      )}
      {editingAnnotation && (
        <AnnotationModal
          sources={sources}
          projects={projects.filter((project) => !project.deletedAt)}
          initialAnnotation={editingAnnotation}
          onClose={() => setEditingAnnotation(null)}
          onSave={async (annotation) => {
            try {
              const source = sources.find(
                (item) => item.id === annotation.sourceId,
              );
              const response = await fetch(
                `/api/excerpts/${editingAnnotation.id}`,
                {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    ...annotation,
                    pageUrl: source?.url,
                    locationData: {
                      pageNumber: annotation.pageNumber || null,
                    },
                  }),
                },
              );
              const saved = await readJsonResponse(response);
              if (!response.ok)
                throw new Error(saved.error ?? "Could not update excerpt");
              setAnnotations((current) =>
                current.map((item) => (item.id === saved.id ? saved : item)),
              );
              setEditingAnnotation(null);
              notify("Excerpt updated");
            } catch (error) {
              notify(
                error instanceof Error
                  ? error.message
                  : "Could not update excerpt",
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
      {walkthroughStep !== null && (
        <Walkthrough
          step={walkthroughStep}
          onBack={() => goToWalkthroughStep(walkthroughStep - 1)}
          onNext={() => goToWalkthroughStep(walkthroughStep + 1)}
          onClose={() => setWalkthroughStep(null)}
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

function UniversalSearchResults({
  results,
  onSource,
  onProject,
  onTag,
}: {
  results: { sources: Source[]; projects: Project[]; tags: string[] };
  onSource: (source: Source) => void;
  onProject: (project: Project) => void;
  onTag: (tag: string) => void;
}) {
  const hasResults =
    results.sources.length || results.projects.length || results.tags.length;
  return (
    <div className="universal-search-results">
      {results.projects.length > 0 && (
        <SearchResultGroup title="Projects">
          {results.projects.map((project) => (
            <button key={project.id} onClick={() => onProject(project)}>
              <FolderOpen size={15} />
              <span>
                <strong>{project.name}</strong>
                {project.description && <small>{project.description}</small>}
              </span>
            </button>
          ))}
        </SearchResultGroup>
      )}
      {results.sources.length > 0 && (
        <SearchResultGroup title="Sources">
          {results.sources.map((source) => (
            <button key={source.id} onClick={() => onSource(source)}>
              <FileText size={15} />
              <span>
                <strong>{source.title}</strong>
                <small>{source.authors || source.organization}</small>
              </span>
            </button>
          ))}
        </SearchResultGroup>
      )}
      {results.tags.length > 0 && (
        <SearchResultGroup title="Tags">
          {results.tags.map((tag) => (
            <button key={tag} onClick={() => onTag(tag)}>
              <Tag size={15} />
              <span>
                <strong>#{tag}</strong>
              </span>
            </button>
          ))}
        </SearchResultGroup>
      )}
      {!hasResults && (
        <div className="universal-search-empty">
          No matching research found.
        </div>
      )}
    </div>
  );
}

function SearchResultGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="search-result-group">
      <div>{title}</div>
      {children}
    </section>
  );
}

function Dashboard({
  userName,
  sources,
  projects,
  annotations,
  onSource,
  onProject,
  onAddProject,
  onNavigate,
}: {
  userName: string;
  sources: Source[];
  projects: Project[];
  annotations: Annotation[];
  onSource: (s: Source) => void;
  onProject: (project: Project) => void;
  onAddProject: () => void;
  onNavigate: (view: string) => void;
}) {
  const activeProjects = projects.filter(
    (project) => project.isActive && !project.deletedAt,
  );
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
        <button className="btn primary" onClick={onAddProject}>
          <Plus size={16} /> Create project
        </button>
      </div>
      <div className="dashboard-priority">
        <section className="card featured-projects">
          <div className="card-header">
            <div className="section-heading">
              <span className="section-heading-icon">
                <Layers3 size={15} />
              </span>
              <div>
                <h3>Active projects</h3>
                <p>
                  Your research in progress · {activeProjects.length} active
                </p>
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
            {activeProjects.map((p, index) => (
              <button
                className="project project-feature"
                key={p.id}
                onClick={() => onProject(p)}
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
            {!activeProjects.length && (
              <div className="project-showcase-empty">
                No active projects. Mark one active from the Projects page.
              </div>
            )}
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
                  <h3>Recent excerpts</h3>
                  <p>Your latest evidence and notes</p>
                </div>
              </div>
              <button
                className="text-button"
                onClick={() => onNavigate("Annotations")}
              >
                View excerpts <ArrowRight size={14} />
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
  projects,
  activeType,
  onType,
  onSource,
  onDelete,
  onCopy,
  onEdit,
  onAdd,
}: {
  sources: Source[];
  projects: Project[];
  activeType: SourceType | "All";
  onType: (type: SourceType | "All") => void;
  onSource: (s: Source) => void;
  onDelete: (id: string) => void;
  onCopy: (s: Source) => void;
  onEdit: (source: Source) => void;
  onAdd: () => void;
}) {
  const [sourceQuery, setSourceQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("All");
  const [tagFilter, setTagFilter] = useState("All");
  const [sortBy, setSortBy] = useState("newest");
  const sourceTags = [
    ...new Set(sources.flatMap((source) => source.tags)),
  ].sort();
  const sourceProjects = projects
    .filter((project) =>
      sources.some((source) => source.projects.includes(project.id)),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );
  const visibleSources = useMemo(() => {
    const value = sourceQuery.trim().toLowerCase();
    return sources
      .filter(
        (source) =>
          (activeType === "All" || source.type === activeType) &&
          (projectFilter === "All" ||
            source.projects.includes(projectFilter)) &&
          (tagFilter === "All" || source.tags.includes(tagFilter)) &&
          (!value ||
            [
              source.title,
              source.authors,
              source.organization,
              source.description,
              source.bibliographyAnnotation,
              ...source.tags,
            ]
              .join(" ")
              .toLowerCase()
              .includes(value)),
      )
      .sort((a, b) => {
        if (sortBy === "oldest") return a.createdAt.localeCompare(b.createdAt);
        if (sortBy === "title") return a.title.localeCompare(b.title);
        if (sortBy === "author")
          return (a.authors || a.organization).localeCompare(
            b.authors || b.organization,
          );
        if (sortBy === "publication") return b.date.localeCompare(a.date);
        if (sortBy === "project")
          return (projectMap.get(a.projects[0])?.name || "").localeCompare(
            projectMap.get(b.projects[0])?.name || "",
          );
        if (sortBy === "tag")
          return (a.tags[0] || "").localeCompare(b.tags[0] || "");
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [
    activeType,
    projectFilter,
    projectMap,
    sortBy,
    sourceQuery,
    sources,
    tagFilter,
  ]);
  const hasSourceFilters = Boolean(
    sourceQuery || projectFilter !== "All" || tagFilter !== "All",
  );
  function clearSourceFilters() {
    setSourceQuery("");
    setProjectFilter("All");
    setTagFilter("All");
    onType("All");
  }
  return (
    <>
      <div className="page-title">
        <div>
          <div className="kicker">Research library</div>
          <h2>All sources</h2>
          <p>Review, organize, and cite everything you have collected.</p>
        </div>
        <button className="btn primary" onClick={onAdd}>
          <Plus size={16} /> New source
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
      <section className="card source-library-controls">
        <div className="source-library-search">
          <Search size={15} />
          <input
            value={sourceQuery}
            onChange={(event) => setSourceQuery(event.target.value)}
            aria-label="Search sources"
          />
        </div>
        <label>
          <span>Project</span>
          <select
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
          >
            <option>All</option>
            {sourceProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Tag</span>
          <select
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
          >
            <option>All</option>
            {sourceTags.map((tag) => (
              <option key={tag}>{tag}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
          >
            <option value="newest">Recently saved</option>
            <option value="oldest">Oldest saved</option>
            <option value="title">Title A–Z</option>
            <option value="author">Author A–Z</option>
            <option value="publication">Publication date</option>
            <option value="project">Project A–Z</option>
            <option value="tag">Tag A–Z</option>
          </select>
        </label>
        <div className="source-results-summary">
          <span>
            {visibleSources.length} of {sources.length} sources
          </span>
          {(hasSourceFilters || activeType !== "All") && (
            <button className="text-button" onClick={clearSourceFilters}>
              <X size={12} /> Clear
            </button>
          )}
        </div>
      </section>
      {visibleSources.length ? (
        visibleSources.map((s) => (
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
                {s.bibliographyAnnotation && (
                  <span className="source-bibliography-preview">
                    <BookOpen size={12} />
                    {s.bibliographyAnnotation}
                  </span>
                )}
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
                title="Edit source"
                onClick={() => onEdit(s)}
              >
                <Pencil size={15} />
              </button>
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
          <p>Try a different search, type, project, or tag.</p>
          {(hasSourceFilters || activeType !== "All") && (
            <button className="btn" onClick={clearSourceFilters}>
              Clear filters
            </button>
          )}
          {!sources.length && (
            <button className="btn primary" onClick={onAdd}>
              <Plus size={15} /> New source
            </button>
          )}
        </div>
      )}
    </>
  );
}

function AnnotationsView({
  annotations,
  sources,
  projects,
  onSource,
  onAdd,
  onCopy,
  onEdit,
  onDelete,
}: {
  annotations: Annotation[];
  sources: Source[];
  projects: Project[];
  onSource: (source: Source) => void;
  onAdd: () => void;
  onCopy: (annotation: Annotation) => void;
  onEdit: (annotation: Annotation) => void;
  onDelete: (annotation: Annotation) => void;
}) {
  const [excerptQuery, setExcerptQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [projectFilter, setProjectFilter] = useState("All");
  const [tagFilter, setTagFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [sortBy, setSortBy] = useState("newest");
  const sourceMap = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources],
  );
  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );
  const excerptSources = sources
    .filter((source) => annotations.some((item) => item.sourceId === source.id))
    .sort((a, b) => a.title.localeCompare(b.title));
  const excerptProjects = projects
    .filter((project) =>
      annotations.some((item) => item.projects.includes(project.id)),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const excerptTags = [
    ...new Set(annotations.flatMap((item) => item.tags)),
  ].sort();
  const excerptTypes = [
    ...new Set(annotations.map((item) => item.type)),
  ].sort();
  const visibleExcerpts = useMemo(() => {
    const value = excerptQuery.trim().toLowerCase();
    const result = annotations.filter((excerpt) => {
      const source = sourceMap.get(excerpt.sourceId);
      return (
        (sourceFilter === "All" || excerpt.sourceId === sourceFilter) &&
        (projectFilter === "All" || excerpt.projects.includes(projectFilter)) &&
        (tagFilter === "All" || excerpt.tags.includes(tagFilter)) &&
        (typeFilter === "All" || excerpt.type === typeFilter) &&
        (!value ||
          [
            excerpt.selectedText,
            excerpt.note,
            excerpt.type,
            source?.title,
            ...excerpt.tags,
          ]
            .join(" ")
            .toLowerCase()
            .includes(value))
      );
    });
    return result.sort((a, b) => {
      if (sortBy === "oldest") return a.createdAt.localeCompare(b.createdAt);
      if (sortBy === "source")
        return (sourceMap.get(a.sourceId)?.title || "").localeCompare(
          sourceMap.get(b.sourceId)?.title || "",
        );
      if (sortBy === "project")
        return (projectMap.get(a.projects[0])?.name || "").localeCompare(
          projectMap.get(b.projects[0])?.name || "",
        );
      if (sortBy === "tag")
        return (a.tags[0] || "").localeCompare(b.tags[0] || "");
      if (sortBy === "type") return a.type.localeCompare(b.type);
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [
    annotations,
    excerptQuery,
    projectFilter,
    projectMap,
    sortBy,
    sourceFilter,
    sourceMap,
    tagFilter,
    typeFilter,
  ]);
  const hasFilters =
    excerptQuery ||
    sourceFilter !== "All" ||
    projectFilter !== "All" ||
    tagFilter !== "All" ||
    typeFilter !== "All";
  function clearFilters() {
    setExcerptQuery("");
    setSourceFilter("All");
    setProjectFilter("All");
    setTagFilter("All");
    setTypeFilter("All");
  }
  return (
    <>
      <div className="page-title">
        <div>
          <div className="kicker">Evidence library</div>
          <h2>Excerpts</h2>
          <p>
            Passages, evidence, questions, and notes captured from your
            research.
          </p>
        </div>
        <button className="btn primary" onClick={onAdd}>
          <Plus size={16} /> New excerpt
        </button>
      </div>
      <section className="card excerpt-controls">
        <div className="excerpt-search">
          <Search size={15} />
          <input
            value={excerptQuery}
            onChange={(event) => setExcerptQuery(event.target.value)}
            aria-label="Search excerpts"
          />
        </div>
        <div className="excerpt-filter-grid">
          <label>
            <span>Source</span>
            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
            >
              <option>All</option>
              {excerptSources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Project</span>
            <select
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
            >
              <option>All</option>
              {excerptProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Tag</span>
            <select
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
            >
              <option>All</option>
              {excerptTags.map((tag) => (
                <option key={tag}>{tag}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Type</span>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option>All</option>
              {excerptTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Sort</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="source">Source A–Z</option>
              <option value="project">Project A–Z</option>
              <option value="tag">Tag A–Z</option>
              <option value="type">Type A–Z</option>
            </select>
          </label>
        </div>
        <div className="excerpt-results-summary">
          <span>
            {visibleExcerpts.length} of {annotations.length} excerpts
          </span>
          {hasFilters && (
            <button className="text-button" onClick={clearFilters}>
              <X size={12} /> Clear filters
            </button>
          )}
        </div>
      </section>
      <div className="card excerpt-list">
        {visibleExcerpts.map((a) => {
          const source = sourceMap.get(a.sourceId);
          const excerptProject = projectMap.get(a.projects[0]);
          return (
            <div className="annotation" key={a.id}>
              <div className="annotation-top">
                <div className="annotation-context">
                  <span className="annotation-type">
                    <Highlighter size={12} />
                    {a.type}
                  </span>
                  {source && (
                    <button
                      className="excerpt-source-link"
                      onClick={() => onSource(source)}
                    >
                      {source.title}
                    </button>
                  )}
                </div>
                <AnnotationActions
                  annotation={a}
                  onCopy={onCopy}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              </div>
              <div className="quote">{a.selectedText}</div>
              <div className="note">{a.note}</div>
              <div className="excerpt-footer">
                <div>
                  {a.tags.map((t) => (
                    <span className="pill" key={t}>
                      #{t}
                    </span>
                  ))}
                </div>
                <span>
                  {excerptProject?.name || "No project"} · {a.createdAt}
                </span>
              </div>
            </div>
          );
        })}
        {!visibleExcerpts.length && (
          <div className="empty excerpt-empty">
            <Search size={23} />
            <h3>No excerpts found</h3>
            <p>Adjust your search or filters to see more evidence.</p>
            {hasFilters && (
              <button className="btn" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function ProjectsView({
  projects,
  sources,
  annotations,
  onAdd,
  onProject,
  onState,
  onRequestDelete,
}: {
  projects: Project[];
  sources: Source[];
  annotations: Annotation[];
  onAdd: () => void;
  onProject: (project: Project) => void;
  onState: (
    project: Project,
    action: "unarchive" | "archive",
  ) => void | Promise<void>;
  onRequestDelete: (project: Project) => void;
}) {
  const [showArchived, setShowArchived] = useState(false);
  const [projectQuery, setProjectQuery] = useState("");
  const active = projects.filter(
    (project) => !project.deletedAt && project.isActive,
  );
  const archived = projects.filter(
    (project) => !project.deletedAt && !project.isActive,
  );
  const availableProjects = showArchived ? [...active, ...archived] : active;
  const visibleProjects = availableProjects.filter((project) =>
    [project.name, project.description]
      .join(" ")
      .toLowerCase()
      .includes(projectQuery.trim().toLowerCase()),
  );
  return (
    <>
      <div className="page-title">
        <div>
          <div className="kicker">Workspaces</div>
          <h2>Projects</h2>
          <p>Organize sources and excerpts into focused research spaces.</p>
        </div>
        <button className="btn primary" onClick={onAdd}>
          <Plus size={16} /> New project
        </button>
      </div>
      <div className="project-tabs-row">
        <div className="project-total">
          {projectQuery
            ? `${visibleProjects.length} of ${availableProjects.length} projects`
            : showArchived
              ? `${availableProjects.length} projects shown`
              : `${active.length} active ${active.length === 1 ? "project" : "projects"}`}
        </div>
        <div className="project-quick-actions">
          <div className="project-search">
            <Search size={14} />
            <input
              value={projectQuery}
              onChange={(event) => setProjectQuery(event.target.value)}
              aria-label="Search projects"
            />
            {projectQuery && (
              <button
                aria-label="Clear project search"
                onClick={() => setProjectQuery("")}
              >
                <X size={13} />
              </button>
            )}
          </div>
          <ProjectFilter
            showArchived={showArchived}
            archivedCount={archived.length}
            onChange={setShowArchived}
          />
        </div>
      </div>
      <ProjectSection
        title=""
        description=""
        projects={visibleProjects}
        sources={sources}
        annotations={annotations}
        onProject={onProject}
        onState={onState}
        onRequestDelete={onRequestDelete}
        emptyMessage={
          projectQuery
            ? "No projects match your search."
            : archived.length
              ? "No active projects. Use the filter to show archived projects."
              : "No projects here yet."
        }
      />
    </>
  );
}

function ProjectSection({
  title,
  description,
  projects,
  sources,
  annotations,
  onProject,
  onState,
  onRequestDelete,
  emptyMessage = "No projects here yet.",
}: {
  title: string;
  description: string;
  projects: Project[];
  sources: Source[];
  annotations: Annotation[];
  onProject?: (project: Project) => void;
  onState: (
    project: Project,
    action: "unarchive" | "archive",
  ) => void | Promise<void>;
  onRequestDelete: (project: Project) => void;
  emptyMessage?: string;
}) {
  return (
    <section className="project-section">
      {(title || description) && (
        <div className="section-list-heading">
          <div>
            {title && <h3>{title}</h3>}
            {description && <p>{description}</p>}
          </div>
        </div>
      )}
      {projects.length ? (
        <div className="project-library-grid">
          {projects.map((project) => (
            <div
              className="card project-library-card"
              key={project.id}
              role="button"
              tabIndex={0}
              onClick={() => onProject?.(project)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onProject?.(project);
                }
              }}
            >
              <ProjectMenu
                project={project}
                onState={onState}
                onRequestDelete={onRequestDelete}
              />
              <div className="kicker">
                {project.isActive ? "Active project" : "Archived project"}
              </div>
              <h3>{project.name}</h3>
              <p>{project.description || "Research workspace"}</p>
              <div className="project-library-counts">
                <span className="pill green">
                  {
                    sources.filter((source) =>
                      source.projects.includes(project.id),
                    ).length
                  }{" "}
                  sources
                </span>
                <span className="pill">
                  {
                    annotations.filter((annotation) =>
                      annotation.projects.includes(project.id),
                    ).length
                  }{" "}
                  excerpts
                </span>
              </div>
              <ArrowRight className="project-library-arrow" size={16} />
            </div>
          ))}
        </div>
      ) : (
        <div className="project-section-empty">{emptyMessage}</div>
      )}
    </section>
  );
}

function ProjectFilter({
  showArchived,
  archivedCount,
  onChange,
}: {
  showArchived: boolean;
  archivedCount: number;
  onChange: (value: boolean) => void;
}) {
  const filterRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    function close(event: PointerEvent) {
      if (!filterRef.current?.contains(event.target as Node))
        filterRef.current?.removeAttribute("open");
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") filterRef.current?.removeAttribute("open");
    }
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  return (
    <details
      className="project-filter"
      ref={filterRef}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary aria-label="Filter projects" title="Filter projects">
        <Filter size={15} />
        {showArchived && <span />}
      </summary>
      <div>
        <div className="project-filter-heading">Filter projects</div>
        <label>
          <span>
            <strong>Show archived</strong>
            <small>{archivedCount} archived</small>
          </span>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => onChange(event.target.checked)}
          />
          <i className={showArchived ? "on" : ""}>
            <b />
          </i>
        </label>
      </div>
    </details>
  );
}

function ProjectMenu({
  project,
  onState,
  onRequestDelete,
}: {
  project: Project;
  onState: (
    project: Project,
    action: "unarchive" | "archive",
  ) => void | Promise<void>;
  onRequestDelete: (project: Project) => void;
}) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    function close(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node))
        menuRef.current?.removeAttribute("open");
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") menuRef.current?.removeAttribute("open");
    }
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  function closeMenu(event: React.MouseEvent<HTMLButtonElement>) {
    event.currentTarget.closest("details")?.removeAttribute("open");
  }
  return (
    <details
      ref={menuRef}
      className="project-menu"
      onClick={(event) => event.stopPropagation()}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary aria-label={`Actions for ${project.name}`}>
        <MoreHorizontal size={17} />
      </summary>
      <div>
        <button
          onClick={(event) => {
            closeMenu(event);
            onState(project, project.isActive ? "archive" : "unarchive");
          }}
        >
          {project.isActive ? (
            <>
              <Archive size={14} /> Archive
            </>
          ) : (
            <>
              <RotateCcw size={14} /> Unarchive
            </>
          )}
        </button>
        {!project.isActive && (
          <button
            className="danger"
            onClick={(event) => {
              closeMenu(event);
              onRequestDelete(project);
            }}
          >
            <Trash2 size={14} /> Delete project
          </button>
        )}
      </div>
    </details>
  );
}

function ArchivedProjectsView({
  projects,
  sources,
  annotations,
  onProject,
  onState,
  onRequestDelete,
}: {
  projects: Project[];
  sources: Source[];
  annotations: Annotation[];
  onProject: (project: Project) => void;
  onState: (
    project: Project,
    action: "unarchive" | "archive",
  ) => void | Promise<void>;
  onRequestDelete: (project: Project) => void;
}) {
  return (
    <>
      <div className="page-title">
        <div>
          <div className="kicker">Manage</div>
          <h2>Archived projects</h2>
          <p>
            Projects hidden from your dashboard but preserved in your workspace.
          </p>
        </div>
      </div>
      <ProjectSection
        title="Archived"
        description={`${projects.length} archived ${projects.length === 1 ? "project" : "projects"}.`}
        projects={projects}
        sources={sources}
        annotations={annotations}
        onProject={onProject}
        onState={onState}
        onRequestDelete={onRequestDelete}
        emptyMessage="You have no archived projects."
      />
    </>
  );
}

function TagsView({
  sources,
  annotations,
  initialTag,
  onSource,
}: {
  sources: Source[];
  annotations: Annotation[];
  initialTag: string | null;
  onSource: (source: Source) => void;
}) {
  const [tagQuery, setTagQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(initialTag);
  const tags = new Map<string, { sources: number; excerpts: number }>();
  sources
    .flatMap((s) => s.tags)
    .forEach((tag) => {
      const counts = tags.get(tag) || { sources: 0, excerpts: 0 };
      tags.set(tag, { ...counts, sources: counts.sources + 1 });
    });
  annotations
    .flatMap((a) => a.tags)
    .forEach((tag) => {
      const counts = tags.get(tag) || { sources: 0, excerpts: 0 };
      tags.set(tag, { ...counts, excerpts: counts.excerpts + 1 });
    });
  const visibleTags = [...tags.entries()]
    .filter(([tag]) =>
      tag.toLowerCase().includes(tagQuery.toLowerCase().trim()),
    )
    .sort(
      (a, b) => b[1].sources + b[1].excerpts - (a[1].sources + a[1].excerpts),
    );
  const taggedSources = selectedTag
    ? sources.filter((source) => source.tags.includes(selectedTag))
    : [];
  const taggedExcerpts = selectedTag
    ? annotations.filter((excerpt) => excerpt.tags.includes(selectedTag))
    : [];
  return (
    <>
      <div className="page-title">
        <div>
          <div className="kicker">Organization</div>
          <h2>Tags</h2>
          <p>Explore related sources and excerpts by topic.</p>
        </div>
      </div>
      <div className="tags-workspace">
        <section className="card tags-browser">
          <div className="tags-search">
            <Search size={15} />
            <input
              value={tagQuery}
              onChange={(event) => setTagQuery(event.target.value)}
              aria-label="Search tags"
            />
          </div>
          <div className="tag-grid">
            {visibleTags.map(([tag, counts]) => (
              <button
                className={`tag-card ${selectedTag === tag ? "active" : ""}`}
                key={tag}
                onClick={() => setSelectedTag(tag)}
              >
                <span className="tag-card-icon">
                  <Tag size={14} />
                </span>
                <strong>#{tag}</strong>
                <small>
                  {counts.sources} sources · {counts.excerpts} excerpts
                </small>
                <ArrowRight size={13} />
              </button>
            ))}
            {!visibleTags.length && (
              <div className="tags-empty">No matching tags.</div>
            )}
          </div>
        </section>
        <section className="card tag-detail">
          {selectedTag ? (
            <>
              <div className="tag-detail-heading">
                <div>
                  <div className="kicker">Selected tag</div>
                  <h3>#{selectedTag}</h3>
                </div>
                <button
                  className="icon-btn"
                  aria-label="Close tag details"
                  onClick={() => setSelectedTag(null)}
                >
                  <X size={15} />
                </button>
              </div>
              <div className="tag-detail-section">
                <h4>Sources</h4>
                {taggedSources.map((source) => (
                  <button
                    className="tag-related-item"
                    key={source.id}
                    onClick={() => onSource(source)}
                  >
                    <FileText size={15} />
                    <span>
                      <strong>{source.title}</strong>
                      <small>{source.authors || source.organization}</small>
                    </span>
                    <ArrowRight size={13} />
                  </button>
                ))}
                {!taggedSources.length && <p>No directly tagged sources.</p>}
              </div>
              <div className="tag-detail-section">
                <h4>Excerpts</h4>
                {taggedExcerpts.map((excerpt) => {
                  const source = sources.find(
                    (item) => item.id === excerpt.sourceId,
                  );
                  return (
                    <button
                      className="tag-related-item excerpt"
                      key={excerpt.id}
                      disabled={!source}
                      onClick={() => source && onSource(source)}
                    >
                      <Highlighter size={15} />
                      <span>
                        <strong>{excerpt.selectedText}</strong>
                        <small>{source?.title}</small>
                      </span>
                      <ArrowRight size={13} />
                    </button>
                  );
                })}
                {!taggedExcerpts.length && <p>No tagged excerpts.</p>}
              </div>
            </>
          ) : (
            <div className="tag-detail-empty">
              <Tag size={25} />
              <h3>Select a tag</h3>
              <p>See every related source and excerpt in one place.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function SettingsView({
  user,
  darkMode,
  onTheme,
  onStartWalkthrough,
}: {
  user: { name: string; email: string };
  darkMode: boolean;
  onTheme: () => void;
  onStartWalkthrough: () => void;
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
        <section className="card settings-card settings-tour-card">
          <div>
            <h3>Getting started</h3>
            <p>Take a guided tour of the workspace and browser extension.</p>
          </div>
          <button className="setting-row" onClick={onStartWalkthrough}>
            <span className="setting-icon">
              <BookOpen size={17} />
            </span>
            <span>
              <strong>App walkthrough</strong>
              <small>About 2 minutes · 10 steps</small>
            </span>
            <ArrowRight size={15} />
          </button>
        </section>
      </div>
    </>
  );
}

function Walkthrough({
  step,
  onBack,
  onNext,
  onClose,
}: {
  step: number;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const current = walkthroughSteps[step];
  const isLast = step === walkthroughSteps.length - 1;
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && step > 0) onBack();
      if (event.key === "ArrowRight" || event.key === "Enter") onNext();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onBack, onClose, onNext, step]);

  return (
    <div className="walkthrough-layer" role="presentation">
      <button
        className="walkthrough-dismiss-area"
        aria-label="Close walkthrough"
        onClick={onClose}
      />
      <section
        className="walkthrough-card"
        role="dialog"
        aria-modal="true"
        aria-live="polite"
        aria-labelledby="walkthrough-title"
      >
        <div className="walkthrough-progress" aria-hidden="true">
          {walkthroughSteps.map((_, index) => (
            <span key={index} className={index <= step ? "complete" : ""} />
          ))}
        </div>
        <div className="walkthrough-heading">
          <div className="walkthrough-icon">
            {"extension" in current ? (
              current.extension === "source" ? <BookmarkPlus size={19} /> : <Highlighter size={19} />
            ) : step === 1 ? (
              <FolderOpen size={19} />
            ) : step === 2 ? (
              <Library size={19} />
            ) : step === 4 ? (
              <Tag size={19} />
            ) : step === 5 ? (
              <Archive size={19} />
            ) : step === 6 ? (
              <Search size={19} />
            ) : (
              <BookOpen size={19} />
            )}
          </div>
          <button ref={closeButtonRef} className="icon-btn" onClick={onClose} aria-label="Close walkthrough">
            <X size={15} />
          </button>
        </div>
        <div className="walkthrough-copy">
          <span>{current.eyebrow}</span>
          <h3 id="walkthrough-title">{current.title}</h3>
          <p>{current.description}</p>
        </div>
        {"extension" in current && (
          <div className="walkthrough-extension-demo">
            <div className="walkthrough-browser-bar">
              <i /><i /><i />
              <span>Article page</span>
            </div>
            {current.extension === "source" ? (
              <div className="walkthrough-extension-flow">
                <span><BookmarkPlus size={14} /> Review citation</span>
                <ArrowRight size={13} />
                <span><FolderOpen size={14} /> Choose project</span>
                <ArrowRight size={13} />
                <span><BookOpen size={14} /> Save source</span>
              </div>
            ) : (
              <div className="walkthrough-highlight-flow">
                <mark>Select the passage you want to remember.</mark>
                <div><Highlighter size={14} /> Add note, tags & page</div>
              </div>
            )}
          </div>
        )}
        <div className="walkthrough-footer">
          <span>{step + 1} of {walkthroughSteps.length}</span>
          <div>
            {step > 0 && <button className="btn" onClick={onBack}>Back</button>}
            <button className="btn primary" onClick={onNext}>
              {isLast ? "Finish" : "Next"}
              {!isLast && <ArrowRight size={14} />}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ProjectDeleteModal({
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
          <strong>{project.name}</strong> will be permanently deleted. Its
          sources and excerpts will remain in your library, but this project and
          its organization cannot be recovered.
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

function ProjectDetail({
  project,
  sources,
  annotations,
  onBack,
  onSource,
  onAddSource,
  onState,
  onRequestDelete,
}: {
  project: Project;
  sources: Source[];
  annotations: Annotation[];
  onBack: () => void;
  onSource: (source: Source) => void;
  onAddSource: () => void;
  onState: (
    project: Project,
    action: "unarchive" | "archive",
  ) => void | Promise<void>;
  onRequestDelete: (project: Project) => void;
}) {
  const annotationCount = annotations.filter((annotation) =>
    annotation.projects.includes(project.id),
  ).length;
  return (
    <>
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={15} /> All projects
      </button>
      <div className="page-title project-detail-title">
        <div>
          <div className="kicker">Project</div>
          <h2>{project.name}</h2>
          <p>{project.description || "Your collected research sources."}</p>
          <div className="project-detail-counts">
            <span>{sources.length} sources</span>
            <span>{annotationCount} excerpts</span>
          </div>
        </div>
        <div className="project-detail-actions">
          <button className="btn primary" onClick={onAddSource}>
            <BookmarkPlus size={16} /> Save a source
          </button>
          <ProjectMenu
            project={project}
            onState={onState}
            onRequestDelete={onRequestDelete}
          />
        </div>
      </div>
      <section className="project-source-list">
        <div className="section-list-heading">
          <div>
            <h3>Sources</h3>
            <p>Everything saved to this project.</p>
          </div>
        </div>
        {sources.length ? (
          sources.map((source) => {
            const sourceAnnotations = annotations.filter(
              (annotation) => annotation.sourceId === source.id,
            ).length;
            return (
              <button
                className="card project-source-card"
                key={source.id}
                onClick={() => onSource(source)}
              >
                <span className="source-type-icon">
                  <FileText size={18} />
                </span>
                <span className="project-source-copy">
                  <span className="source-kind">{source.type}</span>
                  <strong>{source.title}</strong>
                  <small>
                    {[source.authors, source.organization, source.date]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                  <span className="project-source-tags">
                    {source.tags.slice(0, 4).map((tag) => (
                      <span className="pill" key={tag}>
                        #{tag}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="project-source-annotation-count">
                  {sourceAnnotations} excerpts
                </span>
                <ArrowRight size={16} />
              </button>
            );
          })
        ) : (
          <div className="card empty">
            <Library size={24} />
            <h3>No sources in this project yet</h3>
            <p>Save a source and assign it to {project.name}.</p>
            <button className="btn primary" onClick={onAddSource}>
              <BookmarkPlus size={15} /> Save a source
            </button>
          </div>
        )}
      </section>
    </>
  );
}

function SourceDetail({
  source,
  annotations,
  onEdit,
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
  const [style, setStyle] = useState("APA");
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
  const text = citation(source, style);
  return (
    <div className="source-detail-page">
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={15} /> Back
      </button>
      <div className="page-title source-detail-title">
        <div>
          <div className="kicker">{source.type}</div>
          <h2>{source.title}</h2>
          <p>
            {[source.authors, source.organization, source.date]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="source-detail-actions">
          <a className="btn" href={source.url} target="_blank" rel="noreferrer">
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
              <select value={style} onChange={(e) => setStyle(e.target.value)}>
                <option>APA</option>
                <option>MLA</option>
                <option>Chicago</option>
              </select>
            </label>
            <button
              className="btn citation-copy-button"
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
        <div className="citation citation-full">{text}</div>
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

function AnnotationActions({
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
  const [f, setF] = useState({
    title: initialSource?.title || "",
    authors: initialSource?.authors || "",
    organization: initialSource?.organization || "",
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
  const [tags, setTags] = useState<string[]>(initialSource?.tags || []);
  const [newProject, setNewProject] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  async function analyzeLink(event: React.FormEvent) {
    event.preventDefault();
    setAnalyzing(true);
    setAnalysisError("");
    try {
      const response = await fetch("/api/sources/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: analysisUrl }),
      });
      const data = await readJsonResponse(response);
      if (!response.ok)
        throw new Error(data.error ?? "Could not analyze this link");
      setF((current) => ({
        ...current,
        title: data.title || "",
        authors: Array.isArray(data.authors) ? data.authors.join("\n") : "",
        organization: data.organization || "",
        date: data.date || "",
        url: data.url || analysisUrl,
        type: sourceTypes.includes(data.type) ? data.type : "Website",
        description: data.description || "",
      }));
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
              type="url"
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
