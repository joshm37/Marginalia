import { BookOpen } from "lucide-react";

export default function Loading() {
  return (
    <div className="workspace-state" role="status" aria-label="Loading workspace">
      <div className="brand-mark"><BookOpen size={18} /></div>
      <div className="loading-line" />
      <p>Opening your research workspace…</p>
    </div>
  );
}
