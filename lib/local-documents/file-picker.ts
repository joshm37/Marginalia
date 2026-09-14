import type { LocalFileSelection } from "./types";

type FilePickerWindow = Window &
  typeof globalThis & {
    showOpenFilePicker?: (options?: {
      multiple?: boolean;
      types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
      }>;
    }) => Promise<FileSystemFileHandle[]>;
  };

export function supportsPersistentFileHandles() {
  return (
    typeof window !== "undefined" &&
    typeof (window as FilePickerWindow).showOpenFilePicker === "function"
  );
}

export async function chooseLocalPdf(): Promise<LocalFileSelection | null> {
  const picker = (window as FilePickerWindow).showOpenFilePicker;
  if (picker) {
    try {
      const [handle] = await picker({
        multiple: false,
        types: [
          {
            description: "PDF documents",
            accept: { "application/pdf": [".pdf"] },
          },
        ],
      });
      if (!handle) return null;
      return { file: await handle.getFile(), handle };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return null;
      throw error;
    }
  }

  return new Promise((resolve) => {
    let settled = false;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,.pdf";
    input.addEventListener(
      "change",
      () => {
        settled = true;
        resolve(input.files?.[0] ? { file: input.files[0] } : null);
      },
      { once: true },
    );
    input.addEventListener("cancel", () => {
      settled = true;
      resolve(null);
    }, { once: true });
    window.addEventListener("focus", () => {
      window.setTimeout(() => {
        if (!settled && !input.files?.length) resolve(null);
      }, 300);
    }, { once: true });
    input.click();
  });
}
