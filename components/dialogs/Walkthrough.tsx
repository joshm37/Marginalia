"use client";

import { Archive, ArrowRight, BookOpen, BookmarkPlus, FolderOpen, Highlighter, Library, Search, Tag, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { walkthroughSteps } from "@/lib/workspace/walkthrough";

export function Walkthrough({
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
              current.extension === "source" ? (
                <BookmarkPlus size={19} />
              ) : (
                <Highlighter size={19} />
              )
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
          <button
            ref={closeButtonRef}
            className="icon-btn"
            onClick={onClose}
            aria-label="Close walkthrough"
          >
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
              <i />
              <i />
              <i />
              <span>Article page</span>
            </div>
            {current.extension === "source" ? (
              <div className="walkthrough-extension-flow">
                <span>
                  <BookmarkPlus size={14} /> Review citation
                </span>
                <ArrowRight size={13} />
                <span>
                  <FolderOpen size={14} /> Choose project
                </span>
                <ArrowRight size={13} />
                <span>
                  <BookOpen size={14} /> Save source
                </span>
              </div>
            ) : (
              <div className="walkthrough-highlight-flow">
                <mark>Select the passage you want to remember.</mark>
                <div>
                  <Highlighter size={14} /> Add note, tags & page
                </div>
              </div>
            )}
          </div>
        )}
        <div className="walkthrough-footer">
          <span>
            {step + 1} of {walkthroughSteps.length}
          </span>
          <div>
            {step > 0 && (
              <button className="btn" onClick={onBack}>
                Back
              </button>
            )}
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

