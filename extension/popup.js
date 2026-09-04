import { getSession, signIn, signOut } from "./auth-service.js";
import {
  checkDuplicate,
  createProject as createProjectRequest,
  getProjects,
  getTags,
  enrichDoi,
  appUrl,
} from "./api-service.js";
import { normalizeUrl } from "./url-normalization.js";
const $ = (selector) => document.querySelector(selector);
const views = ["loading", "login", "capture", "excerpt", "success"];
const show = (id) =>
  views.forEach((view) =>
    $(`#${view}`).classList.toggle("hidden", view !== id),
  );
const status = (message) => {
  $("#status").textContent = message || "";
};
const PROJECTS_KEY = "marginaliaProjects";
const SOURCES_KEY = "marginaliaSavedSources";
let sourceTags = [];
let sourceCitationData;
let successDestination = { sourceId: null, projectId: null };
let pendingSelection = null;
let excerptContext = null;

function showSuccess({ title, message, sourceId, projectId }) {
  $("#successTitle").textContent = title;
  $("#successMessage").textContent = message;
  successDestination = { sourceId, projectId };
  $("#openSavedSource").classList.toggle("hidden", !sourceId);
  $("#openSavedProject").classList.toggle("hidden", !projectId);
  show("success");
}
async function applySavedTheme() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "get-popup-theme",
    });
    const theme =
      response?.theme === "dark" || response?.theme === "light"
        ? response.theme
        : matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    document.documentElement.dataset.theme = theme;
  } catch {
    document.documentElement.dataset.theme = matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches
      ? "dark"
      : "light";
  }
}
function setupTagEditor() {
  const root = $("#sourceTagEditor"),
    control = root.querySelector(".tag-control"),
    input = root.querySelector("input"),
    menu = root.querySelector(".tag-options");
  let options = [];
  const render = () => {
    control.querySelectorAll(".tag-chip").forEach((node) => node.remove());
    sourceTags.forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.textContent = `#${tag}`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.onclick = () => {
        sourceTags = sourceTags.filter((item) => item !== tag);
        render();
      };
      chip.append(remove);
      control.insertBefore(chip, input);
    });
    const matches = options
      .filter(
        (option) =>
          !sourceTags.includes(option.name) &&
          (!input.value.trim() ||
            option.name.includes(input.value.trim().toLowerCase())),
      )
      .slice(0, 7);
    menu.replaceChildren(
      ...matches.map((option) => {
        const row = document.createElement("button");
        row.type = "button";
        row.textContent = `#${option.name}`;
        row.onclick = () => {
          sourceTags.push(option.name);
          input.value = "";
          menu.classList.add("hidden");
          render();
        };
        return row;
      }),
    );
    menu.classList.toggle("hidden", !matches.length);
  };
  const add = () => {
    const name = input.value.trim().toLowerCase();
    if (name && !sourceTags.includes(name)) sourceTags.push(name);
    input.value = "";
    render();
  };
  input.onfocus = () => {
    menu.classList.remove("hidden");
    render();
  };
  input.oninput = render;
  input.onkeydown = (event) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add();
    } else if (event.key === "Backspace" && !input.value && sourceTags.length) {
      sourceTags.pop();
      render();
    }
  };
  getTags()
    .then((data) => {
      options = data;
      render();
    })
    .catch(() => undefined);
}
function renderProjects(projects, selectedId) {
  $("#project").innerHTML =
    '<option value="" disabled>Select a project</option><option value="__new__">Create a new project…</option>';
  projects.forEach((project) => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name;
    $("#project").insertBefore(option, $("#project").lastElementChild);
  });
  $("#project").value =
    selectedId && projects.some((project) => project.id === selectedId)
      ? selectedId
      : projects[0]?.id || "";
}

async function extractPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active page found");
  const pdfUrl = /\.pdf(?:$|[?#])/i.test(tab.url || "");
  if (pdfUrl)
    return {
      title: (tab.title || "PDF document").replace(/\.pdf\s*$/i, ""),
      url: tab.url,
      canonicalUrl: (tab.url || "").replace(/#.*$/, ""),
      authors: [], organization: "", date: "", doi: "", type: "Report",
      containerTitle: "", volume: "", issue: "", pages: "",
      isPdf: true,
    };
  let injection;
  try {
    injection = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const metadata = new Map();
      document.querySelectorAll("meta").forEach((node) => {
        const key = (node.name || node.getAttribute("property") || "")
          .trim()
          .toLowerCase();
        const value = (node.content || "").trim();
        if (key && value)
          metadata.set(key, [...(metadata.get(key) || []), value]);
      });
      const meta = (...names) =>
        names.flatMap((name) => metadata.get(name.toLowerCase()) || [])[0] ||
        "";
      const metas = (...names) =>
        names.flatMap((name) => metadata.get(name.toLowerCase()) || []);
      const normalizeDate = (raw) => {
        if (!raw) return "";
        const value = String(raw).trim();
        const numeric = value.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
        if (numeric)
          return `${numeric[1]}-${numeric[2].padStart(2, "0")}-${numeric[3].padStart(2, "0")}`;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return "";
        const year = parsed.getUTCFullYear();
        return year > 1000 ? parsed.toISOString().slice(0, 10) : "";
      };
      const canonical =
        document.querySelector('link[rel~="canonical" i]')?.href || "";
      const values = [
        ...document.querySelectorAll('script[type="application/ld+json"]'),
      ]
        .map((node) => {
          try {
            return JSON.parse(node.textContent || "");
          } catch {
            return null;
          }
        })
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .flatMap((value) => [value, ...(value?.["@graph"] || [])]);
      const jsonLd =
        values.filter(Boolean).sort((a, b) => {
          const score = (value) =>
            (/Article|Report|NewsArticle|ScholarlyArticle|Book|WebPage/i.test(
              [].concat(value?.["@type"] || []).join(" "),
            )
              ? 20
              : 0) +
            (value?.headline || value?.name ? 5 : 0) +
            (value?.author ? 4 : 0);
          return score(b) - score(a);
        })[0] || {};
      const authorValue = jsonLd.author;
      const structuredAuthors = (
        Array.isArray(authorValue) ? authorValue : [authorValue]
      )
        .map((item) =>
          item && typeof item === "object"
            ? item.name ||
              [item.givenName, item.familyName].filter(Boolean).join(" ")
            : item,
        )
        .filter(Boolean);
      const metadataAuthors = metas(
        "citation_author",
        "dc.creator",
        "DC.creator",
      );
      const genericAuthors = meta("author")
        .split(/;|\s+and\s+/i)
        .filter(Boolean);
      const authors = [
        ...new Set(
          [...structuredAuthors, ...metadataAuthors, ...genericAuthors]
            .map((value) => String(value).trim())
            .filter(Boolean),
        ),
      ];
      const rawDate =
        jsonLd.datePublished ||
        meta(
          "article:published_time",
          "citation_publication_date",
          "citation_online_date",
          "citation_date",
          "prism.publicationdate",
          "prism.coverdate",
          "dc.date",
          "DC.date",
          "date",
          "datePublished",
        );
      const containerTitle =
        meta(
          "citation_journal_title",
          "citation_conference_title",
          "prism.publicationname",
          "dc.source",
        ) ||
        jsonLd.isPartOf?.name ||
        "";
      const structuredType = [].concat(jsonLd["@type"] || []).join(" ");
      const type = /Report/i.test(structuredType)
        ? "Report"
        : /Book/i.test(structuredType)
          ? "Book"
          : containerTitle ||
              /Article|NewsArticle|ScholarlyArticle/i.test(structuredType)
            ? "Article"
            : "Website";
      const firstPage = meta(
        "citation_firstpage",
        "citation_pages",
        "prism.startingpage",
      );
      const lastPage = meta("citation_lastpage", "prism.endingpage");
      const date = normalizeDate(rawDate);
      const organization =
        jsonLd.publisher?.name ||
        meta("citation_publisher", "dc.publisher", "prism.corporatename", "og:site_name");
      const doiCandidate =
        meta(
          "citation_doi",
          "dc.identifier",
          "dc.identifier.doi",
          "prism.doi",
        ) ||
        String(jsonLd.identifier?.value || jsonLd.identifier || "") ||
        document.querySelector('a[href*="doi.org/"]')?.href ||
        "";
      const doi = doiCandidate.match(/10\.\d{4,9}\/[\w.()/:+-]+/i)?.[0] || "";
      const title =
        meta("citation_title", "dc.title", "og:title", "twitter:title") ||
        jsonLd.headline ||
        document.title;
      const pages =
        firstPage && lastPage
          ? `${firstPage}-${lastPage}`
          : firstPage || jsonLd.pagination || "";
      const structuredNames = authors.map((name) => {
        if (/\b(university|institute|association|agency|department|press)\b/i.test(name))
          return { literal: name };
        const parts = name.trim().split(/\s+/);
        return parts.length > 1
          ? { given: parts.slice(0, -1).join(" "), family: parts.at(-1) }
          : { literal: name };
      });
      return {
        title,
        url: location.href,
        canonicalUrl: canonical,
        authors,
        organization,
        date,
        doi,
        type,
        containerTitle,
        volume:
          meta("citation_volume", "prism.volume") || jsonLd.volumeNumber || "",
        issue:
          meta("citation_issue", "prism.number") || jsonLd.issueNumber || "",
        pages,
        citationData: {
          title,
          type: type === "Article" ? "article-journal" : type.toLowerCase(),
          authors: structuredNames,
          publisher: organization || undefined,
          containerTitle: containerTitle || undefined,
          volume: meta("citation_volume", "prism.volume") || jsonLd.volumeNumber || undefined,
          issue: meta("citation_issue", "prism.number") || jsonLd.issueNumber || undefined,
          pages: pages || undefined,
          issued: date ? { "date-parts": [date.split("-").map(Number)] } : undefined,
          url: canonical || location.href,
          doi: doi || undefined,
          isbn: metas("citation_isbn", "prism.isbn"),
          issn: metas("citation_issn", "prism.issn"),
          abstract: meta("citation_abstract", "dc.description", "description") || undefined,
        },
      };
    },
    });
  } catch {
    return {
      title: tab.title || new URL(tab.url).hostname,
      url: tab.url,
      canonicalUrl: tab.url,
      authors: [], organization: "", date: "", doi: "", type: "Website",
      containerTitle: "", volume: "", issue: "", pages: "",
      extractionWarning: "This page did not allow automatic metadata extraction. Review the fields before saving.",
    };
  }
  return injection[0].result;
}
async function openCapture() {
  show("loading");
  status("");
  const pending = await chrome.storage.session.get("marginaliaPendingSelection");
  if (pending.marginaliaPendingSelection) {
    pendingSelection = pending.marginaliaPendingSelection;
    await chrome.storage.session.remove("marginaliaPendingSelection");
    try {
      const duplicate = await checkDuplicate({ url: pendingSelection.url });
      if (duplicate.duplicate && duplicate.source) {
        const projects = await getProjects();
        const projectId = duplicate.source.projects?.[0];
        prepareExcerpt(pendingSelection, {
          sourceId: duplicate.source.id,
          sourceTitle: duplicate.source.title,
          projectId,
          projectName: projects.find((project) => project.id === projectId)?.name || "Project",
        });
        return;
      }
    } catch {
      // Continue to source capture; the selection remains available afterward.
    }
  }
  const cached = await chrome.storage.local.get(PROJECTS_KEY);
  let page = await extractPage();
  if (page.doi) {
    try {
      const enriched = await enrichDoi(page.doi);
      if (enriched.enriched) {
        page = {
          ...page,
          ...enriched,
          url: page.url,
          canonicalUrl: page.canonicalUrl,
        };
      }
    } catch {
      // Crossref is optional; retain the page metadata and review flow.
    }
  }
  sourceCitationData = page.citationData;
  const projects = cached[PROJECTS_KEY] || [];
  $("#title").value = page.title || "";
  $("#url").value = page.url || "";
  $("#authors").value = (page.authors || []).join("\n");
  $("#organization").value = page.organization || "";
  $("#date").value = /^\d{4}-\d{2}-\d{2}$/.test(page.date) ? page.date : "";
  $("#doi").value = page.doi || "";
  $("#containerTitle").value = page.containerTitle || "";
  $("#volume").value = page.volume || "";
  $("#issue").value = page.issue || "";
  $("#pages").value = page.pages || "";
  $("#type").value = page.type || "Website";
  $("#typeBadge").textContent = page.enriched
    ? `${page.type || "Article"} · Crossref`
    : page.type || "Website";
  renderProjects(projects);
  $("#capture").dataset.canonicalUrl = page.canonicalUrl || "";
  show("capture");
  if (pendingSelection)
    status("Save this source first, then Marginalia will attach your selected excerpt.");
  if (page.extractionWarning) status(page.extractionWarning);
  $("#signout").classList.remove("hidden");
  getProjects()
    .then((fresh) => {
      const selected = $("#project").value;
      chrome.storage.local.set({ [PROJECTS_KEY]: fresh });
      renderProjects(fresh, selected);
    })
    .catch((error) => status(error.message));
}
$("#login").addEventListener("submit", async (event) => {
  event.preventDefault();
  status("");
  const button = event.submitter;
  button.disabled = true;
  try {
    await signIn($("#email").value, $("#password").value);
    await openCapture();
  } catch (error) {
    status(error.message);
    show("login");
  } finally {
    button.disabled = false;
  }
});
$("#project").addEventListener("change", () =>
  $("#newProjectRow").classList.toggle(
    "hidden",
    $("#project").value !== "__new__",
  ),
);
$("#createProject").addEventListener("click", async () => {
  const name = $("#newProjectName").value.trim();
  if (!name) return;
  const button = $("#createProject");
  button.disabled = true;
  status("");
  try {
    const project = await createProjectRequest(name);
    const cached = await chrome.storage.local.get(PROJECTS_KEY);
    const projects = [...(cached[PROJECTS_KEY] || []), project];
    await chrome.storage.local.set({ [PROJECTS_KEY]: projects });
    renderProjects(projects, project.id);
    $("#newProjectName").value = "";
    $("#newProjectRow").classList.add("hidden");
  } catch (error) {
    status(error.message);
  } finally {
    button.disabled = false;
  }
});
$("#capture").addEventListener("submit", async (event) => {
  event.preventDefault();
  status("");
  if (!$("#project").value || $("#project").value === "__new__") {
    status("Create or select a project before saving.");
    return;
  }
  const button = $("#save");
  button.disabled = true;
  button.textContent = "Saving…";
  try {
    const source = {
      title: $("#title").value.trim(),
      url: $("#url").value,
      canonicalUrl: event.currentTarget.dataset.canonicalUrl || undefined,
      authors: $("#authors")
        .value.split("\n")
        .map((value) => value.trim())
        .filter(Boolean)
        .join(", "),
      organization: $("#organization").value.trim(),
      date: $("#date").value,
      doi: $("#doi").value.trim(),
      containerTitle: $("#containerTitle").value.trim(),
      volume: $("#volume").value.trim(),
      issue: $("#issue").value.trim(),
      pages: $("#pages").value.trim(),
      type: $("#type").value,
      tags: sourceTags,
      projects: [$("#project").value],
      notes: $("#notes").value.trim(),
      citationData: sourceCitationData,
    };
    const duplicate = await checkDuplicate(source);
    if (duplicate.duplicate) {
      const existingProject = duplicate.source.projects?.[0] || $("#project").value;
      showSuccess({
        title: "Already in your library",
        message: "Marginalia found the existing source instead of creating a duplicate.",
        sourceId: duplicate.source.id,
        projectId: existingProject,
      });
      return;
    }
    const saveResult = await chrome.runtime.sendMessage({ type: "save-source", source });
    if (saveResult?.error) throw Object.assign(new Error(saveResult.error), { code: saveResult.code });
    if (saveResult?.queued) {
      showSuccess({ title: "Queued for retry", message: saveResult.message });
      return;
    }
    const saved = saveResult.source;
    const stored = await chrome.storage.local.get([SOURCES_KEY, PROJECTS_KEY]);
    const project = (stored[PROJECTS_KEY] || []).find(
      (item) => item.id === $("#project").value,
    );
    const context = {
      sourceId: saved.id,
      sourceTitle: saved.title,
      projectId: $("#project").value,
      projectName: project?.name || "Project",
    };
    const mappings = stored[SOURCES_KEY] || {};
    mappings[normalizeUrl(source.url)] = context;
    if (source.canonicalUrl)
      mappings[normalizeUrl(source.canonicalUrl)] = context;
    await chrome.storage.local.set({ [SOURCES_KEY]: mappings });
    await chrome.runtime.sendMessage({ type: "invalidate-tags" });
    if (pendingSelection) {
      prepareExcerpt(pendingSelection, context);
      pendingSelection = null;
      return;
    }
    showSuccess({
      title: "Saved to Marginalia",
      message: "This source is now available in your dashboard.",
      sourceId: saved.id,
      projectId: $("#project").value,
    });
  } catch (error) {
    status(error.message);
    if (error.code === "SESSION_EXPIRED") show("login");
  } finally {
    button.disabled = false;
    button.textContent = "Save to Marginalia";
  }
});
function prepareExcerpt(selection, context) {
  excerptContext = { ...context, pageUrl: selection.url };
  $("#excerptText").textContent = selection.selectedText;
  $("#excerptDestination").textContent = `${context.sourceTitle} · ${context.projectName}`;
  $("#excerptPage").value = selection.pageNumber || "";
  $("#excerptPageBadge").textContent = selection.pageNumber ? `Page ${selection.pageNumber}` : "Selection";
  $("#excerptNote").value = "";
  $("#excerptTags").value = "";
  show("excerpt");
}
$("#excerpt").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("#saveExcerpt");
  button.disabled = true;
  button.textContent = "Saving…";
  status("");
  try {
    const pageNumber = $("#excerptPage").value.trim();
    const result = await chrome.runtime.sendMessage({
      type: "save-annotation",
      annotation: {
        sourceId: excerptContext.sourceId,
        selectedText: $("#excerptText").textContent,
        surroundingText: "",
        note: $("#excerptNote").value.trim(),
        pageUrl: excerptContext.pageUrl,
        type: $("#excerptType").value,
        tags: $("#excerptTags").value.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean),
        projects: [excerptContext.projectId],
        locationData: { pageNumber: pageNumber || undefined },
      },
    });
    if (result?.error) throw Object.assign(new Error(result.error), { code: result.code });
    showSuccess({
      title: result?.queued ? "Queued for retry" : "Excerpt saved",
      message: result?.message || "Your selected text is now attached to this source.",
      sourceId: excerptContext.sourceId,
      projectId: excerptContext.projectId,
    });
  } catch (error) {
    status(error.message);
    if (error.code === "SESSION_EXPIRED") show("login");
  } finally {
    button.disabled = false;
    button.textContent = "Save excerpt";
  }
});
$("#openSavedSource").addEventListener("click", () => {
  if (successDestination.sourceId)
    chrome.tabs.create({ url: appUrl(`/sources/${successDestination.sourceId}`) });
});
$("#openSavedProject").addEventListener("click", () => {
  if (successDestination.projectId)
    chrome.tabs.create({ url: appUrl(`/projects/${successDestination.projectId}`) });
});
$("#signout").addEventListener("click", async () => {
  await signOut();
  await chrome.runtime.sendMessage({ type: "invalidate-tags" });
  $("#signout").classList.add("hidden");
  status("");
  show("login");
});
$("#saveAnother").addEventListener("click", () =>
  openCapture().catch((error) => {
    status(error.message);
    show("login");
  }),
);
applySavedTheme();
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.marginaliaTheme) applySavedTheme();
  if (
    area === "local" &&
    changes.marginaliaSession &&
    !changes.marginaliaSession.newValue
  ) {
    status("Your session ended. Sign in again to continue.");
    $("#signout").classList.add("hidden");
    show("login");
  }
});
getSession()
  .then((session) => (session ? openCapture() : show("login")))
  .catch((error) => {
    status(error.message);
    show("login");
  });
setupTagEditor();
chrome.runtime.sendMessage({ type: "queue-status" }).then((result) => {
  if (result?.count)
    status(`${result.count} capture${result.count === 1 ? " is" : "s are"} waiting to retry.`);
}).catch(() => undefined);
