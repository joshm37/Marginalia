import Link from "next/link";
import { legalContentStatus } from "@/lib/legal";

export const metadata = { title: "Privacy Policy · Marginalia" };

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <article className="card legal-document">
        <p className="kicker">{legalContentStatus.status.replaceAll("_", " ")}</p>
        <h1>Privacy Policy</h1>
        <div className="legal-placeholder" role="note">
          This page is a structural placeholder, not final legal language. It must be reviewed and replaced or approved by the project owner and qualified counsel before public beta use.
        </div>
        <h2>Information the final policy must cover</h2>
        <ul>
          <li>Account information handled through Supabase Auth.</li>
          <li>User-created projects, sources, citation metadata, tags, notes, and excerpts.</li>
          <li>Webpage metadata submitted for source analysis and enrichment-provider processing.</li>
          <li>Chrome extension permissions, local session storage, and queued captures.</li>
          <li>Hosting, database, authentication, metadata-provider, retention, deletion, export, and support practices.</li>
        </ul>
        <h2>Owner-supplied details still required</h2>
        <p>Legal entity and contact details, jurisdiction, retention periods, subprocessors, user-rights process, cookie practices, age restrictions, and an effective date.</p>
        <Link className="btn" href="/settings">Back to settings</Link>
      </article>
    </main>
  );
}
