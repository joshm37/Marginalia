let marginaliaHost = null;
let selectionTimer = null;
let lastSelection = "";
function removePopup() {
  marginaliaHost?.remove();
  marginaliaHost = null;
  lastSelection = "";
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
  const response = await chrome.runtime
    .sendMessage({ type: "annotation-context", url: location.href })
    .catch((error) => ({ error: error.message }));
  if (!response?.context) {
    if (response?.error) console.warn("Marginalia:", response.error);
    return;
  }
  lastSelection = captured.selectedText;
  removePopup();
  const rect = captured.rect;
  marginaliaHost = document.createElement("div");
  marginaliaHost.style.cssText = `position:fixed;z-index:2147483647;left:${Math.max(12, Math.min(window.innerWidth - 344, rect.left))}px;top:${Math.max(12, Math.min(window.innerHeight - 340, rect.bottom + 10))}px;width:332px;`;
  const shadow = marginaliaHost.attachShadow({ mode: "open" });
  shadow.innerHTML = `<style>*{box-sizing:border-box}.box{padding:14px;border:1px solid #d8d5cd;border-radius:10px;background:#fff;color:#1b2520;box-shadow:0 14px 42px rgba(0,0,0,.22);font:12px system-ui,sans-serif}.head{display:flex;justify-content:space-between;gap:10px}.brand{color:#315c4b;font-weight:800;font-size:11px}.close{border:0;background:transparent;color:#777;cursor:pointer;font-size:17px;line-height:1}.destination{margin:4px 0 10px;color:#777;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.quote{max-height:58px;overflow:hidden;margin:0 0 10px;padding:8px 9px;border-left:3px solid #315c4b;background:#f5f5f1;font:11px/1.45 Georgia,serif}.row{display:grid;grid-template-columns:1fr 1fr;gap:7px}label{display:block;margin:7px 0 0;color:#747873;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}input,select,textarea{width:100%;margin-top:4px;padding:7px;border:1px solid #d8d5cd;border-radius:6px;background:#fff;color:#1b2520;font:11px system-ui;outline:none}textarea{min-height:48px;resize:vertical}.save{width:100%;margin-top:10px;padding:8px;border:0;border-radius:6px;background:#315c4b;color:#fff;font-weight:800;cursor:pointer}.save:disabled{opacity:.6}.message{margin-top:7px;color:#9a4f46;font-size:10px}.done{color:#315c4b}</style><div class="box"><div class="head"><span class="brand">Save to Marginalia</span><button class="close" aria-label="Close">×</button></div><div class="destination"></div><div class="quote"></div><div class="row"><label>Type<select><option>Quote</option><option>Evidence</option><option>Summary</option><option>Question</option><option>Counterargument</option><option>Note</option></select></label><label>Tags<input></label></div><label>Annotation<textarea></textarea></label><button class="save">Save annotation</button><div class="message"></div></div>`;
  shadow.querySelector(".destination").textContent =
    `${response.context.sourceTitle} · ${response.context.projectName}`;
  shadow.querySelector(".quote").textContent = `“${captured.selectedText}”`;
  shadow.querySelector(".close").onclick = removePopup;
  const extraStyle = document.createElement("style");
  extraStyle.textContent =
    ".tag-control{min-height:31px;margin-top:4px;padding:3px 5px;display:flex;align-items:center;flex-wrap:wrap;gap:3px;border:1px solid #d8d5cd;border-radius:6px}.tag-control input{flex:1;min-width:70px;margin:0;border:0;padding:3px}.tag-control input::placeholder{color:#aaa}.tag-chip{display:inline-flex;align-items:center;gap:2px;padding:3px 5px;border-radius:99px;background:#e9efeb;color:#315c4b;font-size:8px}.tag-chip button{width:0;overflow:hidden;padding:0;border:0;background:transparent;color:inherit;opacity:0}.tag-chip:hover button{width:10px;opacity:1}.tag-options{max-height:105px;overflow:auto;margin-top:3px;padding:3px;border:1px solid #ddd;border-radius:5px}.tag-options.hidden{display:none}.tag-options button{width:100%;padding:5px;border:0;background:#fff;text-align:left;font-size:9px}.tag-options button:hover{background:#f5f5f1}.page-field{display:block;width:72px;margin-top:7px}.page-field input{width:64px}";
  shadow.append(extraStyle);
  let selectedTags = [],
    tagOptions = [];
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
    tagMenu.classList.toggle("hidden", !matches.length);
  };
  const addTag = () => {
    const name = tagInput.value.trim().toLowerCase();
    if (name && !selectedTags.includes(name)) selectedTags.push(name);
    tagInput.value = "";
    renderTags();
  };
  tagInput.onfocus = () => {
    tagMenu.classList.remove("hidden");
    renderTags();
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
  pageLabel.textContent = "Page number (optional)";
  const pageInput = document.createElement("input");
  pageInput.className = "page-number";
  pageLabel.append(pageInput);
  shadow.querySelector(".row").after(pageLabel);
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
      button.textContent = "Save annotation";
    }
  };
  document.documentElement.appendChild(marginaliaHost);
  shadow.querySelector("textarea").focus();
  shadow.querySelector(".box").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (!saveButton.disabled) saveButton.click();
    }
  });
}
function queueSelection() {
  clearTimeout(selectionTimer);
  selectionTimer = setTimeout(() => {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) showPopup(selection);
  }, 120);
}
document.addEventListener(
  "mouseup",
  (event) => {
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
document.addEventListener("selectionchange", queueSelection);
document.addEventListener(
  "mousedown",
  (event) => {
    if (marginaliaHost && !event.composedPath().includes(marginaliaHost)) {
      removePopup();
      lastSelection = "";
    }
  },
  { capture: true },
);
