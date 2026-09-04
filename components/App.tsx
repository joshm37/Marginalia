"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowRight,
  BookOpen,
  BookmarkPlus,
  ChevronDown,
  FolderOpen,
  Highlighter,
  Home,
  Library,
  LogOut,
  Moon,
  Search,
  Settings,
  Sun,
  Tag,
} from "lucide-react";
import { Annotation, Project, Source, SourceType } from "@/lib/types";
import {
  postJson,
  readJsonResponse,
  requestCitation,
  SESSION_EXPIRED_EVENT,
} from "@/lib/client/api";
import type { WorkspaceView } from "@/components/workspace/types";
import { walkthroughSteps } from "@/lib/workspace/walkthrough";
import { UniversalSearchResults } from "@/components/workspace/UniversalSearchResults";
import { Dashboard } from "@/components/features/dashboard/Dashboard";
import { SourcesView } from "@/components/features/sources/SourcesView";
import { SourceDetail } from "@/components/features/sources/SourceDetail";
import { AnnotationsView } from "@/components/features/excerpts/ExcerptsView";
import {
  ArchivedProjectsView,
  ProjectsView,
} from "@/components/features/projects/ProjectsView";
import { ProjectDetail } from "@/components/features/projects/ProjectDetail";
import { TagsView } from "@/components/features/tags/TagsView";
import { SettingsView } from "@/components/features/settings/SettingsView";
import {
  AnnotationModal,
  ProjectModal,
  SourceModal,
} from "@/components/dialogs/WorkspaceDialogs";
import { Walkthrough } from "@/components/dialogs/Walkthrough";
import {
  ArchiveConfirmationModal,
  DeleteConfirmationModal,
  ProjectDeleteModal,
} from "@/components/dialogs/ProjectDeleteDialog";
import { ProjectExportDialog } from "@/components/dialogs/ProjectExportDialog";


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

function subscribeToConnection(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function useOnlineStatus() {
  return useSyncExternalStore(
    subscribeToConnection,
    () => navigator.onLine,
    () => true,
  );
}

function setTheme(dark: boolean) {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  localStorage.setItem("rcm-theme", dark ? "dark" : "light");
  window.dispatchEvent(new Event(THEME_EVENT));
}

const viewRoutes: Record<Exclude<WorkspaceView, "Project" | "Source">, string> = {
  Dashboard: "/",
  Projects: "/projects",
  Sources: "/sources",
  Annotations: "/excerpts",
  Tags: "/tags",
  Archived: "/archived",
  Settings: "/settings",
};

export default function App({
  initialData,
  initialRoute,
}: {
  initialData: {
    sources: Source[];
    projects: Project[];
    excerpts: Annotation[];
    user: { id: string; name: string; email: string };
  };
  initialRoute: {
    view: WorkspaceView;
    projectId?: string;
    sourceId?: string;
    tag?: string;
  };
}) {
  const router = useRouter();
  const [sources, setSources] = useState<Source[]>(initialData.sources);
  const [projects, setProjects] = useState<Project[]>(initialData.projects);
  const [annotations, setAnnotations] = useState<Annotation[]>(
    initialData.excerpts,
  );
  const [user, setUser] = useState(initialData.user);
  const [accountMenu, setAccountMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const darkMode = useDarkMode();
  const isOnline = useOnlineStatus();
  const accountRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<WorkspaceView>(initialRoute.view);
  const [query, setQuery] = useState("");
  const [searchedTag, setSearchedTag] = useState<string | null>(
    initialRoute.tag ?? null,
  );
  const [modal, setModal] = useState<
    "source" | "annotation" | "project" | null
  >(null);
  const [selectedSource, setSelectedSource] = useState<Source | null>(
    initialData.sources.find((source) => source.id === initialRoute.sourceId) ??
      null,
  );
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(
    null,
  );
  const [annotationDefaults, setAnnotationDefaults] = useState<{
    sourceId?: string;
    projectId?: string;
  }>({});
  const [selectedProject, setSelectedProject] = useState<Project | null>(
    initialData.projects.find(
      (project) => project.id === initialRoute.projectId,
    ) ?? null,
  );
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [projectToArchive, setProjectToArchive] =
    useState<Project | null>(null);
  const [projectToExport, setProjectToExport] = useState<Project | null>(null);
  const [sourceToDelete, setSourceToDelete] = useState<Source | null>(null);
  const [annotationToDelete, setAnnotationToDelete] =
    useState<Annotation | null>(null);
  const [projectBackView, setProjectBackView] =
    useState<WorkspaceView>("Projects");
  const [sourceBackView, setSourceBackView] =
    useState<WorkspaceView>("Sources");
  const [toast, setToast] = useState("");
  const [sourceType, setSourceType] = useState<SourceType | "All">("All");
  const [walkthroughStep, setWalkthroughStep] = useState<number | null>(null);

  useEffect(() => {
    function restoreViewFromHistory() {
      const path = window.location.pathname;
      const projectMatch = path.match(/^\/projects\/([^/]+)$/);
      const sourceMatch = path.match(/^\/sources\/([^/]+)$/);
      if (projectMatch) {
        const project = projects.find(
          (item) => item.id === decodeURIComponent(projectMatch[1]),
        );
        if (project) {
          setSelectedProject(project);
          setSelectedSource(null);
          setView("Project");
          return;
        }
      }
      if (sourceMatch) {
        const source = sources.find(
          (item) => item.id === decodeURIComponent(sourceMatch[1]),
        );
        if (source) {
          setSelectedSource(source);
          setSelectedProject(null);
          setView("Source");
          return;
        }
      }
      const route = Object.entries(viewRoutes).find(
        ([, href]) => href === path,
      )?.[0] as Exclude<WorkspaceView, "Project" | "Source"> | undefined;
      setSelectedProject(null);
      setSelectedSource(null);
      setView(route ?? "Dashboard");
      setSearchedTag(
        path === "/tags"
          ? new URLSearchParams(window.location.search).get("tag")
          : null,
      );
    }
    window.addEventListener("popstate", restoreViewFromHistory);
    return () =>
      window.removeEventListener("popstate", restoreViewFromHistory);
  }, [projects, sources]);

  useEffect(() => {
    async function refreshWorkspace() {
      try {
        const response = await fetch("/api/workspace", { cache: "no-store" });
        const data = await readJsonResponse(response);
        if (!response.ok) return;
        setSources(data.sources);
        setProjects(data.projects);
        setAnnotations(data.excerpts);
        setUser(data.user);
      } catch {
        // The server-rendered snapshot remains usable if a background refresh fails.
      }
    }
    const refresh = () => {
      if (document.visibilityState === "visible") refreshWorkspace();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  useEffect(() => {
    function handleSessionExpired() {
      const next = `${location.pathname}${location.search}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      router.refresh();
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () =>
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [router]);
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
  function navigate(nextView: WorkspaceView, updateUrl = true) {
    setSelectedSource(null);
    if (nextView !== "Project") setSelectedProject(null);
    setView(nextView);
    if (updateUrl && nextView !== "Project" && nextView !== "Source") {
      const href = viewRoutes[nextView];
      if (`${location.pathname}${location.search}` !== href)
        window.history.pushState(null, "", href);
    }
  }
  function goToWalkthroughStep(index: number) {
    const step = walkthroughSteps[index];
    if (!step) {
      setWalkthroughStep(null);
      return;
    }
    navigate(step.view, false);
    setWalkthroughStep(index);
  }
  function openProject(project: Project) {
    setProjectBackView(view);
    setSelectedProject(project);
    setSelectedSource(null);
    setView("Project");
    const href = `/projects/${project.id}`;
    if (location.pathname !== href) window.history.pushState(null, "", href);
  }
  function openSource(source: Source) {
    setSourceBackView(view);
    setSelectedSource(source);
    setView("Source");
    const href = `/sources/${source.id}`;
    if (location.pathname !== href) window.history.pushState(null, "", href);
  }
  async function deleteSource(id: string) {
    const previousSources = sources;
    const previousAnnotations = annotations;
    setSources((current) => current.filter((source) => source.id !== id));
    setAnnotations((current) =>
      current.filter((annotation) => annotation.sourceId !== id),
    );
    const response = await fetch(`/api/sources/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setSources(previousSources);
      setAnnotations(previousAnnotations);
      return notify("Could not delete source");
    }
    setSourceToDelete(null);
    if (selectedSource?.id === id) {
      setSelectedSource(null);
      navigate(sourceBackView);
    }
    notify("Source deleted");
  }
  async function updateProjectState(
    project: Project,
    action: "unarchive" | "archive",
  ) {
    const previousProjects = projects;
    const optimistic = {
      ...project,
      isActive: action === "unarchive",
    };
    setProjects((current) =>
      current.map((item) => (item.id === project.id ? optimistic : item)),
    );
    if (selectedProject?.id === project.id) setSelectedProject(optimistic);
    const response = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await readJsonResponse(response);
    if (!response.ok) {
      setProjects(previousProjects);
      if (selectedProject?.id === project.id) setSelectedProject(project);
      return notify(data.error ?? "Could not update the project");
    }
    setProjects((current) =>
      current.map((item) => (item.id === data.id ? data : item)),
    );
    if (selectedProject?.id === data.id) setSelectedProject(data);
    if (action === "archive") setProjectToArchive(null);
    notify(action === "unarchive" ? "Project unarchived" : "Project archived");
  }
  async function permanentlyDeleteProject(project: Project) {
    const previousProjects = projects;
    const previousSources = sources;
    const previousAnnotations = annotations;
    const removedSourceIds = new Set(
      sources
        .filter((source) => source.projects.includes(project.id))
        .map((source) => source.id),
    );
    setProjects((current) =>
      current.filter((item) => item.id !== project.id),
    );
    setSources((current) =>
      current.filter((source) => !removedSourceIds.has(source.id)),
    );
    setAnnotations((current) =>
      current.filter(
        (annotation) => !removedSourceIds.has(annotation.sourceId),
      ),
    );
    const response = await fetch(`/api/projects/${project.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setProjects(previousProjects);
      setSources(previousSources);
      setAnnotations(previousAnnotations);
      const data = await readJsonResponse(response);
      return notify(data.error ?? "Could not permanently delete the project");
    }
    setProjectToDelete(null);
    if (selectedProject?.id === project.id) navigate(projectBackView);
    notify("Project and its sources deleted");
  }
  async function copyCitation(source: Source) {
    try {
      const text = await requestCitation(source, "APA");
      await navigator.clipboard?.writeText(text);
      notify("APA citation copied");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not format citation",
      );
    }
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
    const previousAnnotations = annotations;
    setAnnotations((current) =>
      current.filter((item) => item.id !== annotation.id),
    );
    const response = await fetch(`/api/excerpts/${annotation.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setAnnotations(previousAnnotations);
      return notify("Could not delete excerpt");
    }
    setAnnotationToDelete(null);
    if (editingAnnotation?.id === annotation.id) setEditingAnnotation(null);
    notify("Excerpt deleted");
  }

  return (
    <div className="app-shell">
      {!isOnline && (
        <div className="connection-banner" role="status">
          You’re offline. Changes cannot be saved until your connection returns.
        </div>
      )}
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
                  setView("Tags");
                  window.history.pushState(
                    null,
                    "",
                    `/tags?tag=${encodeURIComponent(tag)}`,
                  );
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

        <div
          className="content"
          key={`${view}:${selectedProject?.id ?? ""}:${selectedSource?.id ?? ""}:${searchedTag ?? ""}`}
        >
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
              onDelete={(id) =>
                setSourceToDelete(
                  sources.find((source) => source.id === id) ?? null,
                )
              }
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
              onDelete={setAnnotationToDelete}
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
              onState={(project, action) =>
                action === "archive"
                  ? setProjectToArchive(project)
                  : updateProjectState(project, action)
              }
              onRequestDelete={setProjectToDelete}
              onExport={setProjectToExport}
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
              onState={(project, action) =>
                action === "archive"
                  ? setProjectToArchive(project)
                  : updateProjectState(project, action)
              }
              onRequestDelete={setProjectToDelete}
              onExport={setProjectToExport}
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
              onDelete={() => setSourceToDelete(selectedSource)}
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
              onDeleteAnnotation={setAnnotationToDelete}
              onAddAnnotation={() => {
                setAnnotationDefaults({
                  sourceId: selectedSource.id,
                  projectId: selectedSource.projects[0],
                });
                setModal("annotation");
              }}
              onBack={() => {
                setSelectedSource(null);
                navigate(sourceBackView);
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
              onState={(project, action) =>
                action === "archive"
                  ? setProjectToArchive(project)
                  : updateProjectState(project, action)
              }
              onRequestDelete={setProjectToDelete}
              onExport={setProjectToExport}
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

      {projectToArchive && (
        <ArchiveConfirmationModal
          project={projectToArchive}
          onClose={() => setProjectToArchive(null)}
          onConfirm={() => updateProjectState(projectToArchive, "archive")}
        />
      )}

      {projectToExport && (
        <ProjectExportDialog
          project={projectToExport}
          sources={sources.filter((source) =>
            source.projects.includes(projectToExport.id),
          )}
          onClose={() => setProjectToExport(null)}
        />
      )}

      {sourceToDelete && (
        <DeleteConfirmationModal
          title="Delete source permanently?"
          subject={sourceToDelete.title}
          description="and every excerpt connected to it will be permanently deleted. This cannot be undone."
          onClose={() => setSourceToDelete(null)}
          onConfirm={() => deleteSource(sourceToDelete.id)}
        />
      )}

      {annotationToDelete && (
        <DeleteConfirmationModal
          title="Delete excerpt permanently?"
          subject={
            annotationToDelete.selectedText.length > 90
              ? `${annotationToDelete.selectedText.slice(0, 90)}…`
              : annotationToDelete.selectedText
          }
          description="will be permanently deleted. This cannot be undone."
          onClose={() => setAnnotationToDelete(null)}
          onConfirm={() => deleteAnnotation(annotationToDelete)}
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
