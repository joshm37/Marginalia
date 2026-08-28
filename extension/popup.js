import { getSession, signIn, signOut } from "./auth-service.js";
import {
  checkDuplicate,
  createProject as createProjectRequest,
  getProjects,
  getTags,
  saveSource,
} from "./api-service.js";
const $ = (selector) => document.querySelector(selector);
const views = ["loading", "login", "capture", "success"];
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
function normalizeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
    ].forEach((key) => url.searchParams.delete(key));
    url.pathname = url.pathname.replace(/\/$/, "") || "/";
    url.searchParams.sort();
    return url.toString();
  } catch {
    return rawUrl;
  }
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
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const meta = (...names) =>
        names
          .map(
            (name) =>
              document.querySelector(
                `meta[name="${name}"],meta[property="${name}"]`,
              )?.content,
          )
          .find(Boolean) || "";
      const metas = (...names) =>
        names
          .flatMap((name) =>
            [
              ...document.querySelectorAll(
                `meta[name="${name}"],meta[property="${name}"]`,
              ),
            ].map((node) => node.content),
          )
          .filter(Boolean);
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
        document.querySelector('link[rel="canonical"]')?.href || "";
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
        .flatMap((value) => value?.["@graph"] || [value]);
      const jsonLd =
        values.find(
          (value) =>
            value &&
            /Article|Report|NewsArticle|ScholarlyArticle/.test(
              value["@type"] || "",
            ),
        ) || {};
      const authorValue = jsonLd.author;
      const structuredAuthors = (
        Array.isArray(authorValue) ? authorValue : [authorValue]
      )
        .map((item) => item?.name || item)
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
          "citation_date",
          "dc.date",
          "DC.date",
          "date",
          "datePublished",
        );
      return {
        title:
          meta("citation_title", "og:title", "twitter:title") ||
          jsonLd.headline ||
          document.title,
        url: location.href,
        canonicalUrl: canonical,
        authors,
        organization:
          jsonLd.publisher?.name || meta("og:site_name", "citation_publisher"),
        date: normalizeDate(rawDate),
        doi: meta("citation_doi", "dc.identifier"),
      };
    },
  });
  return result;
}
async function openCapture() {
  show("loading");
  status("");
  const cached = await chrome.storage.local.get(PROJECTS_KEY);
  const page = await extractPage();
  const projects = cached[PROJECTS_KEY] || [];
  $("#title").value = page.title || "";
  $("#url").value = page.url || "";
  $("#authors").value = (page.authors || []).join("\n");
  $("#organization").value = page.organization || "";
  $("#date").value = /^\d{4}-\d{2}-\d{2}$/.test(page.date) ? page.date : "";
  $("#doi").value = page.doi || "";
  renderProjects(projects);
  $("#capture").dataset.canonicalUrl = page.canonicalUrl || "";
  show("capture");
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
      type: $("#type").value,
      tags: sourceTags,
      projects: [$("#project").value],
      notes: $("#notes").value.trim(),
    };
    const duplicate = await checkDuplicate(source);
    if (duplicate.duplicate)
      throw new Error("This source is already in your Marginalia library.");
    const saved = await saveSource(source);
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
    show("success");
  } catch (error) {
    status(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Save to Marginalia";
  }
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
getSession()
  .then((session) => (session ? openCapture() : show("login")))
  .catch((error) => {
    status(error.message);
    show("login");
  });
setupTagEditor();
