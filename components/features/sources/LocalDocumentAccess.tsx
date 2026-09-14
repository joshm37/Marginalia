"use client";

import { CheckCircle2, FileSearch, Link2Off, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { chooseLocalPdf, supportsPersistentFileHandles } from "@/lib/local-documents/file-picker";
import { getDeviceFileAssociation, saveDeviceFileAssociation } from "@/lib/local-documents/device-store";
import { sha256File } from "@/lib/local-documents/hash";
import { validateLocalPdf } from "@/lib/local-documents/validation";
import type { Source } from "@/lib/types";

type AccessState = "checking" | "linked" | "unavailable" | "locating" | "mismatch" | "error";

export function LocalDocumentAccess({ source }: { source: Source }) {
  const [state, setState] = useState<AccessState>("checking");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    getDeviceFileAssociation(source.id)
      .then((association) => active && setState(association?.handle ? "linked" : "unavailable"))
      .catch(() => active && setState("unavailable"));
    return () => { active = false; };
  }, [source.id]);

  async function locate() {
    setMessage("");
    try {
      const selection = await chooseLocalPdf();
      if (!selection) return;
      validateLocalPdf(selection.file);
      setState("locating");
      const sha256 = await sha256File(selection.file);
      if (sha256 !== source.localFile?.sha256) {
        setState("mismatch");
        setMessage("That PDF does not match this source. Nothing was changed.");
        return;
      }
      await saveDeviceFileAssociation({
        sourceId: source.id,
        sha256,
        filename: selection.file.name,
        fileSize: selection.file.size,
        mimeType: selection.file.type || "application/pdf",
        ...(selection.file.lastModified ? { lastModified: new Date(selection.file.lastModified).toISOString() } : {}),
        handle: selection.handle,
      });
      setState("linked");
      setMessage("Document re-linked on this device.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not re-link this PDF.");
    }
  }

  return (
    <section className="card local-document-access" aria-live="polite">
      <div>
        {state === "linked" ? <CheckCircle2 size={17} /> : <Link2Off size={17} />}
        <span>
          <strong>{source.localFile?.filename || "Local PDF"}</strong>
          <small>
            {state === "checking" || state === "locating"
              ? "Checking local access…"
              : state === "linked"
                ? "Linked on this device"
                : "Marginalia has the citation, but needs you to locate the PDF on this device."}
          </small>
        </span>
      </div>
      <button className="btn" type="button" onClick={() => void locate()} disabled={state === "checking" || state === "locating"}>
        {state === "locating" ? <LoaderCircle size={14} className="spin" /> : <FileSearch size={14} />}
        Locate file
      </button>
      {message && <p className={state === "mismatch" || state === "error" ? "danger-text" : ""}>{message}</p>}
      {!supportsPersistentFileHandles() && <p>This browser cannot retain file permission, so you may need to locate the PDF again later.</p>}
    </section>
  );
}
