"use client";

import { useEffect } from "react";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="workspace-state error-state">
      <h2>We couldn’t open your workspace.</h2>
      <p>Your research is still safe. Try loading this section again.</p>
      <button className="btn" onClick={reset}>Try again</button>
    </div>
  );
}
