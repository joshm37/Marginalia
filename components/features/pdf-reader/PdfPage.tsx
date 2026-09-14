"use client";

import { useEffect, useRef, useState } from "react";
import { Highlighter, LoaderCircle } from "lucide-react";
import { createPdfTextAnchor, reanchorPdfText, type PdfTextAnchor } from "@/lib/local-documents/excerpt-anchor";
import type { Annotation } from "@/lib/types";

type PdfTextItem = { str: string; transform: number[]; width: number; height: number };
type PdfPageProxy = {
  getViewport(input: { scale: number }): { width: number; height: number; transform: number[]; convertToViewportPoint(x: number, y: number): [number, number] };
  render(input: { canvasContext: CanvasRenderingContext2D; viewport: unknown; transform?: number[] }): { promise: Promise<void>; cancel: () => void };
  getTextContent(): Promise<{ items: Array<PdfTextItem | Record<string, unknown>> }>;
  cleanup(): void;
};
export type PdfDocumentProxyLike = { numPages: number; getPage(page: number): Promise<PdfPageProxy>; destroy(): Promise<void> };

export function PdfPage({
  document,
  pageNumber,
  excerpts,
  onCapture,
  onTextAvailability,
}: {
  document: PdfDocumentProxyLike;
  pageNumber: number;
  excerpts: Annotation[];
  onCapture: (anchor: PdfTextAnchor) => void;
  onTextAvailability: (page: number, available: boolean) => void;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(pageNumber <= 2);
  const [pageText, setPageText] = useState("");
  const [items, setItems] = useState<Array<{ text: string; start: number; end: number; style: React.CSSProperties }>>([]);
  const [error, setError] = useState("");
  const [capture, setCapture] = useState<{ anchor: PdfTextAnchor; x: number; y: number }>();

  useEffect(() => {
    const node = rootRef.current;
    if (!node || visible) return;
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setVisible(true),
      { rootMargin: "900px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    let renderTask: { promise: Promise<void>; cancel: () => void } | undefined;
    let page: PdfPageProxy | undefined;
    void (async () => {
      try {
        page = await document.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.35 });
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context || !active) return;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        rootRef.current?.style.setProperty("--pdf-page-width", `${viewport.width}px`);
        rootRef.current?.style.setProperty("--pdf-page-height", `${viewport.height}px`);
        renderTask = page.render({
          canvasContext: context,
          viewport,
          transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        });
        const textContent = await page.getTextContent();
        const textItems = textContent.items.filter((item): item is PdfTextItem => "str" in item && typeof item.str === "string");
        let offset = 0;
        const positioned = textItems.map((item) => {
          const text = item.str.replace(/\s+/g, " ").trim();
          const start = offset;
          offset += text.length + 1;
          const transform = item.transform;
          const fontHeight = Math.hypot(transform[2], transform[3]) * 1.35;
          const [left, baseline] = viewport.convertToViewportPoint(transform[4], transform[5]);
          const top = baseline - fontHeight;
          return {
            text,
            start,
            end: start + text.length,
            style: {
              left,
              top,
              fontSize: fontHeight,
              transform: `rotate(${Math.atan2(transform[1], transform[0])}rad)`,
            },
          };
        });
        if (active) {
          setItems(positioned);
          setPageText(textItems.map((item) => item.str.replace(/\s+/g, " ").trim()).filter(Boolean).join(" "));
          onTextAvailability(pageNumber, textItems.some((item) => item.str.trim()));
        }
        await renderTask.promise;
      } catch (caught) {
        if (active && !(caught instanceof Error && caught.name === "RenderingCancelledException"))
          setError("This page could not be rendered.");
      }
    })();
    return () => {
      active = false;
      renderTask?.cancel();
      page?.cleanup();
    };
  }, [document, onTextAvailability, pageNumber, visible]);

  const ranges = excerpts.flatMap((excerpt) => {
    const location = excerpt.locationData;
    if (!location?.exact) return [];
    const found = reanchorPdfText(pageText, {
      exact: location.exact,
      prefix: location.prefix || "",
      suffix: location.suffix || "",
      textStart: location.textStart,
    });
    return found ? [found] : [];
  });

  function captureSelection() {
    const selection = window.getSelection();
    const root = rootRef.current;
    if (!selection || selection.isCollapsed || !root || !selection.anchorNode || !root.contains(selection.anchorNode)) return;
    const exact = selection.toString().trim();
    if (exact.length < 2) return;
    const selectionRect = selection.getRangeAt(0).getBoundingClientRect();
    const pageRect = root.getBoundingClientRect();
    const rect = {
      x: Math.round(selectionRect.left - pageRect.left),
      y: Math.round(selectionRect.top - pageRect.top),
      width: Math.round(selectionRect.width),
      height: Math.round(selectionRect.height),
    };
    setCapture({
      anchor: createPdfTextAnchor(pageText, exact, pageNumber, rect),
      x: Math.max(8, Math.min(pageRect.width - 145, rect.x + rect.width / 2 - 60)),
      y: Math.max(8, rect.y + rect.height + 7),
    });
  }

  return (
    <article id={`pdf-page-${pageNumber}`} ref={rootRef} className={`pdf-page ${pageNumber > 2 ? "pdf-page-deferred" : ""}`} aria-label={`Page ${pageNumber}`} onMouseUp={captureSelection} onKeyUp={(event) => { if (event.key.startsWith("Arrow") || event.key === "Shift") captureSelection(); }}>
      <span className="pdf-page-number">{pageNumber}</span>
      {!visible && <div className="pdf-page-placeholder"><LoaderCircle className="spin" size={18} /> Page {pageNumber}</div>}
      {visible && <canvas ref={canvasRef} aria-hidden="true" />}
      {visible && (
        <div className="pdf-text-layer" aria-label={`Selectable text for page ${pageNumber}`}>
          {items.map((item, index) => (
            <span
              key={`${item.start}-${index}`}
              style={item.style}
              className={ranges.some((range) => item.end > range.start && item.start < range.end) ? "saved-excerpt-text" : undefined}
            >
              {item.text}{" "}
            </span>
          ))}
        </div>
      )}
      {visible && !error && items.length === 0 && <p className="pdf-page-text-warning">No selectable text was found on this page.</p>}
      {error && <p className="pdf-page-error" role="alert">{error}</p>}
      {capture && (
        <button
          type="button"
          className="pdf-capture-control"
          style={{ left: capture.x, top: capture.y }}
          onClick={() => { onCapture(capture.anchor); setCapture(undefined); window.getSelection()?.removeAllRanges(); }}
        >
          <Highlighter size={13} /> Save excerpt
        </button>
      )}
    </article>
  );
}
