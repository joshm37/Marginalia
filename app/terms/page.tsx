import Link from "next/link";
import { legalContentStatus } from "@/lib/legal";

export const metadata = { title: "Terms of Service · Marginalia" };

export default function TermsPage() {
  return (
    <main className="legal-page">
      <article className="card legal-document">
        <p className="kicker">{legalContentStatus.status.replaceAll("_", " ")}</p>
        <h1>Terms of Service</h1>
        <div className="legal-placeholder" role="note">
          This page is a structural placeholder, not final terms. It must be reviewed and replaced or approved by the project owner and qualified counsel before public beta use.
        </div>
        <h2>Topics the final terms must cover</h2>
        <ul>
          <li>Who may use Marginalia and acceptable use of the service and extension.</li>
          <li>User responsibility for uploaded research content and third-party rights.</li>
          <li>Beta availability, support expectations, account termination, and data export.</li>
          <li>Warranty, liability, dispute, governing-law, and change-notice provisions.</li>
        </ul>
        <h2>Owner-supplied details still required</h2>
        <p>Legal entity, jurisdiction, eligibility rules, prohibited uses, service commitments, dispute process, liability position, and an effective date.</p>
        <Link className="btn" href="/settings">Back to settings</Link>
      </article>
    </main>
  );
}
