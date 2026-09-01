let marginaliaHost = null;
let selectionTimer = null;
let lastSelection = "";
let anchorRange = null;
let isPointerSelecting = false;
let positionFrame = null;

function removePopup() {
  clearTimeout(selectionTimer);
  if (positionFrame) cancelAnimationFrame(positionFrame);
  marginaliaHost?.remove();
  marginaliaHost = null;
  anchorRange = null;
  lastSelection = "";
}

function dashboardTheme() {
  try {
    const theme = localStorage.getItem("rcm-theme");
    return theme === "dark" || theme === "light" ? theme : null;
  } catch {}
  return null;
}

function syncDashboardTheme() {
  const theme = dashboardTheme();
  if (theme)
    chrome.runtime
      .sendMessage({ type: "set-popup-theme", theme })
      .catch(() => undefined);
}

async function popupTheme() {
  const localTheme = dashboardTheme();
  if (localTheme) {
    chrome.runtime
      .sendMessage({ type: "set-popup-theme", theme: localTheme })
      .catch(() => undefined);
    return localTheme;
  }
  const saved = await chrome.runtime
    .sendMessage({ type: "get-popup-theme" })
    .catch(() => null);
  if (saved?.theme === "dark" || saved?.theme === "light") return saved.theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function positionPopup() {
  if (!marginaliaHost || !anchorRange) return;
  const rect = anchorRange.getBoundingClientRect();
  if (!rect.width && !rect.height) return;
  const anchorVisible = rect.bottom > 0 && rect.top < window.innerHeight;
  marginaliaHost.style.opacity = anchorVisible ? "1" : "0";
  marginaliaHost.style.pointerEvents = anchorVisible ? "auto" : "none";
  if (!anchorVisible) return;
  const width = 304;
  const popupHeight = marginaliaHost.getBoundingClientRect().height || 310;
  const spaceBelow = window.innerHeight - rect.bottom;
  const top =
    spaceBelow >= Math.min(popupHeight + 14, 330)
      ? rect.bottom + 10
      : Math.max(10, rect.top - popupHeight - 10);
  const left = Math.max(
    10,
    Math.min(
      window.innerWidth - width - 10,
      rect.left + rect.width / 2 - width / 2,
    ),
  );
  marginaliaHost.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
}

function queuePosition() {
  if (positionFrame) cancelAnimationFrame(positionFrame);
  positionFrame = requestAnimationFrame(positionPopup);
}
function captureSelection(selection) {
  const range = selection.getRangeAt(0),
    container = range.commonAncestorContainer;
  const text =
      (container.nodeType === Node.TEXT_NODE
        ? container.parentElement
        : container
      )?.textContent || "",
    selectedText = selection.toString().trim(),
    index = text.indexOf(selectedText);
  const rect = range.getBoundingClientRect();
  return {
    selectedText,
    surroundingText:
      index >= 0
        ? text
            .slice(Math.max(0, index - 180), index + selectedText.length + 180)
            .trim()
        : "",
    rect,
    range: range.cloneRange(),
    locationData: {
      title: document.title,
      x: Math.round(rect.x),
      y: Math.round(rect.y),
    },
  };
}
async function showPopup(selection) {
  const captured = captureSelection(selection);
  if (
    captured.selectedText.length < 2 ||
    (captured.selectedText === lastSelection && marginaliaHost)
  )
    return;
  const [response, theme] = await Promise.all([
    chrome.runtime
      .sendMessage({ type: "annotation-context", url: location.href })
      .catch((error) => ({ error: error.message })),
    popupTheme(),
  ]);
  const currentSelection = window.getSelection()?.toString().trim();
  if (isPointerSelecting || currentSelection !== captured.selectedText) return;
  if (!response?.context) {
    if (response?.error) console.warn("Marginalia:", response.error);
    return;
  }
  removePopup();
  lastSelection = captured.selectedText;
  anchorRange = captured.range;
  marginaliaHost = document.createElement("div");
  marginaliaHost.style.cssText =
    "position:fixed;z-index:2147483647;left:0;top:0;width:304px;";
  const shadow = marginaliaHost.attachShadow({ mode: "open" });
  shadow.innerHTML = `<style>:host{--surface:rgba(255,255,255,.96);--surface-raised:#fff;--ink:#18211d;--muted:#747b77;--line:rgba(31,49,40,.14);--soft:#f2f5f3;--accent:#315c4b;--accent-bright:#467c65;--danger:#a44e48;--shadow:0 18px 48px rgba(15,24,19,.18),0 2px 8px rgba(15,24,19,.08)}:host([data-theme="dark"]){--surface:rgba(13,13,13,.96);--surface-raised:#171717;--ink:#f2f3f2;--muted:#9b9f9c;--line:rgba(255,255,255,.13);--soft:#202220;--accent:#62a080;--accent-bright:#78b493;--danger:#e4857d;--shadow:0 22px 60px rgba(0,0,0,.48),0 2px 10px rgba(0,0,0,.35);color-scheme:dark}*{box-sizing:border-box}.box{padding:11px;border:1px solid var(--line);border-radius:14px;background:var(--surface);color:var(--ink);box-shadow:var(--shadow);backdrop-filter:blur(18px) saturate(135%);font:11px/1.35 ui-sans-serif,system-ui,-apple-system,sans-serif}.head{display:flex;align-items:center;justify-content:space-between;gap:8px}.brand{display:flex;align-items:center;gap:6px;color:var(--accent);font-weight:750;font-size:10px;letter-spacing:.01em}.brand:before{content:"";width:7px;height:7px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 16%,transparent)}.close{width:22px;height:22px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--muted);cursor:pointer;font-size:16px;line-height:20px}.close:hover{background:var(--soft);color:var(--ink)}.destination{margin:2px 28px 7px 13px;color:var(--muted);font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.quote{max-height:82px;overflow-y:auto;margin:0 0 7px;padding:7px 9px;border-radius:8px;background:var(--soft);color:var(--ink);font:10px/1.42 Georgia,serif;scrollbar-width:thin;scrollbar-color:var(--muted) transparent}.quote::-webkit-scrollbar{width:5px}.quote::-webkit-scrollbar-thumb{border-radius:8px;background:var(--muted)}.row{display:grid;grid-template-columns:76px minmax(0,1fr) 52px;gap:6px}.row label{position:relative}label{display:block;margin:6px 0 0;color:var(--muted);font-size:7px;font-weight:750;text-transform:uppercase;letter-spacing:.07em}input,select,textarea{width:100%;margin-top:3px;padding:6px 7px;border:1px solid var(--line);border-radius:7px;background:var(--surface-raised);color:var(--ink);font:10px ui-sans-serif,system-ui,sans-serif;outline:none;transition:border-color 100ms,box-shadow 100ms}input:focus,select:focus,textarea:focus{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 18%,transparent)}textarea{min-height:40px;max-height:92px;resize:vertical}.actions{display:flex;align-items:center;gap:7px;margin-top:8px}.shortcut{flex:1;color:var(--muted);font-size:8px}.save{padding:7px 11px;border:0;border-radius:7px;background:var(--accent);color:#fff;font:700 10px ui-sans-serif,system-ui;cursor:pointer;transition:background 90ms,transform 90ms}.save:hover{background:var(--accent-bright);transform:translateY(-1px)}.save:disabled{opacity:.6;transform:none}.message{min-height:0;margin-top:5px;color:var(--danger);font-size:9px}.message:empty{display:none}.done{color:var(--accent)}</style><div class="box"><div class="head"><span class="brand">Marginalia</span><button class="close" aria-label="Close">×</button></div><div class="destination"></div><div class="quote"></div><div class="row"><label>Type<select><option>Quote</option><option>Evidence</option><option>Summary</option><option>Question</option><option>Counterargument</option><option>Note</option></select></label><label>Tags<input></label></div><label>Annotation<textarea></textarea></label><div class="actions"><span class="shortcut">⌘/Ctrl + Enter</span><button class="save">Save annotation</button></div><div class="message"></div></div>`;
  shadow.host.setAttribute("data-theme", theme);
  shadow.innerHTML = shadow.innerHTML
    .replace("<option>Quote</option>", "")
    .replace(">Annotation<", ">Excerpt note<")
    .replace("Save annotation", "Save excerpt");
  shadow.querySelector(".destination").textContent =
    `${response.context.sourceTitle} · ${response.context.projectName}`;
  shadow.querySelector(".quote").textContent = `“${captured.selectedText}”`;
  shadow.querySelector(".close").onclick = removePopup;
  const extraStyle = document.createElement("style");
  extraStyle.textContent =
    ".tag-control{min-height:27px;margin-top:3px;padding:2px 4px;display:flex;align-items:center;flex-wrap:wrap;gap:3px;border:1px solid var(--line);border-radius:7px;background:var(--surface-raised)}.tag-control:focus-within{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 18%,transparent)}.tag-control input{flex:1;min-width:58px;margin:0;border:0;padding:3px;background:transparent;box-shadow:none}.tag-control input::placeholder{color:var(--muted)}.tag-chip{display:inline-flex;align-items:center;gap:2px;padding:3px 5px;border-radius:99px;background:color-mix(in srgb,var(--accent) 16%,var(--surface-raised));color:var(--accent);font-size:8px}.tag-chip button{width:0;overflow:hidden;padding:0;border:0;background:transparent;color:inherit;opacity:0}.tag-chip:hover button{width:10px;opacity:1}.tag-options{position:absolute;z-index:3;max-height:100px;overflow:auto;margin-top:3px;padding:3px;border:1px solid var(--line);border-radius:7px;background:var(--surface-raised);box-shadow:var(--shadow)}.tag-options.hidden{display:none}.tag-options button{width:100%;padding:5px;border:0;border-radius:4px;background:transparent;color:var(--ink);text-align:left;font-size:9px}.tag-options button:hover{background:var(--soft)}.page-field{display:block;width:58px;margin-top:6px}.page-field input{width:52px}";
  shadow.append(extraStyle);
  let selectedTags = [],
    tagOptions = [],
    tagMenuOpen = false;
  const tagLabel = shadow.querySelectorAll("label")[1],
    tagControl = document.createElement("div"),
    tagInput = document.createElement("input"),
    tagMenu = document.createElement("div");
  tagLabel.textContent = "Tags";
  tagControl.className = "tag-control";
  tagInput.placeholder = "Type a tag and press Enter";
  tagMenu.className = "tag-options hidden";
  tagControl.append(tagInput);
  tagLabel.append(tagControl, tagMenu);
  const renderTags = () => {
    tagControl.querySelectorAll(".tag-chip").forEach((node) => node.remove());
    selectedTags.forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.textContent = `#${tag}`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.onclick = () => {
        selectedTags = selectedTags.filter((item) => item !== tag);
        renderTags();
      };
      chip.append(remove);
      tagControl.insertBefore(chip, tagInput);
    });
    const matches = tagOptions
      .filter(
        (option) =>
          !selectedTags.includes(option.name) &&
          (!tagInput.value.trim() ||
            option.name.includes(tagInput.value.trim().toLowerCase())),
      )
      .slice(0, 6);
    tagMenu.replaceChildren(
      ...matches.map((option) => {
        const row = document.createElement("button");
        row.type = "button";
        row.textContent = `#${option.name}`;
        row.onclick = () => {
          selectedTags.push(option.name);
          tagInput.value = "";
          tagMenu.classList.add("hidden");
          renderTags();
        };
        return row;
      }),
    );
    tagMenu.classList.toggle("hidden", !tagMenuOpen || !matches.length);
  };
  const addTag = () => {
    const name = tagInput.value.trim().toLowerCase();
    if (name && !selectedTags.includes(name)) selectedTags.push(name);
    tagInput.value = "";
    renderTags();
  };
  tagInput.onfocus = () => {
    tagMenuOpen = true;
    renderTags();
  };
  tagInput.onblur = () => {
    setTimeout(() => {
      tagMenuOpen = false;
      renderTags();
    }, 120);
  };
  tagInput.oninput = renderTags;
  tagInput.onkeydown = (event) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag();
    } else if (
      event.key === "Backspace" &&
      !tagInput.value &&
      selectedTags.length
    ) {
      selectedTags.pop();
      renderTags();
    }
  };
  chrome.runtime.sendMessage({ type: "list-tags" }).then((result) => {
    tagOptions = result?.tags || [];
    renderTags();
  });
  const pageLabel = document.createElement("label");
  pageLabel.className = "page-field";
  pageLabel.textContent = "Page";
  const pageInput = document.createElement("input");
  pageInput.className = "page-number";
  pageLabel.append(pageInput);
  shadow.querySelector(".row").append(pageLabel);
  const saveButton = shadow.querySelector(".save");
  saveButton.onclick = async () => {
    const button = shadow.querySelector(".save"),
      message = shadow.querySelector(".message");
    button.disabled = true;
    button.textContent = "Saving…";
    message.textContent = "";
    try {
      const result = await chrome.runtime.sendMessage({
        type: "save-annotation",
        annotation: {
          sourceId: response.context.sourceId,
          selectedText: captured.selectedText,
          surroundingText: captured.surroundingText,
          note: shadow.querySelector("textarea").value.trim(),
          pageUrl: location.href,
          type: shadow.querySelector("select").value,
          tags: selectedTags,
          projects: [response.context.projectId],
          locationData: {
            ...captured.locationData,
            pageNumber: pageInput.value.trim() || undefined,
          },
        },
      });
      if (result?.error) throw new Error(result.error);
      message.textContent = "Saved to Marginalia";
      message.classList.add("done");
      button.textContent = "Saved";
      setTimeout(removePopup, 900);
    } catch (error) {
      message.textContent = error.message;
      button.disabled = false;
      button.textContent = "Save excerpt";
    }
  };
  document.documentElement.appendChild(marginaliaHost);
  positionPopup();
  shadow.querySelector(".box").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (!saveButton.disabled) saveButton.click();
    }
  });
}
function queueSelection(delay = 0) {
  clearTimeout(selectionTimer);
  selectionTimer = setTimeout(() => {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) showPopup(selection);
  }, delay);
}
document.addEventListener(
  "mouseup",
  (event) => {
    isPointerSelecting = false;
    if (!event.composedPath().includes(marginaliaHost)) queueSelection();
  },
  { capture: true },
);
document.addEventListener(
  "keyup",
  (event) => {
    if (event.key.startsWith("Arrow") || event.key === "Shift")
      queueSelection();
  },
  { capture: true },
);
document.addEventListener("selectionchange", () => {
  if (!isPointerSelecting) queueSelection();
});
document.addEventListener(
  "mousedown",
  (event) => {
    if (marginaliaHost && !event.composedPath().includes(marginaliaHost)) {
      removePopup();
      lastSelection = "";
    }
    if (!event.composedPath().includes(marginaliaHost)) {
      isPointerSelecting = true;
      clearTimeout(selectionTimer);
    }
  },
  { capture: true },
);
window.addEventListener("scroll", queuePosition, { passive: true });
window.addEventListener("resize", queuePosition, { passive: true });
syncDashboardTheme();
new MutationObserver(syncDashboardTheme).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["data-theme"],
});
