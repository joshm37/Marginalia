"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";

export function PaginationControls({
  page,
  pageCount,
  itemLabel,
  onPage,
}: {
  page: number;
  pageCount: number;
  itemLabel: string;
  onPage: (page: number) => void;
}) {
  return (
    <nav className="pagination" aria-label={`${itemLabel} pages`}>
      <button
        className="btn"
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
      >
        <ArrowLeft size={14} /> Previous
      </button>
      <span>Page {page} of {pageCount}</span>
      <button
        className="btn"
        disabled={page === pageCount}
        onClick={() => onPage(page + 1)}
      >
        Next <ArrowRight size={14} />
      </button>
    </nav>
  );
}

