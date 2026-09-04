import Link from "next/link";

export default function NotFound() {
  return (
    <div className="workspace-state error-state">
      <h2>This research item could not be found.</h2>
      <p>It may have been deleted, or it may belong to another account.</p>
      <Link className="btn" href="/">Return to dashboard</Link>
    </div>
  );
}
