"use client";

import { ArrowRight, BookOpen, Download, FileText, KeyRound, LifeBuoy, MessageSquareWarning, Moon, Sun, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import packageJson from "@/package.json";

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@marginalia.app";

function initials(value: string) {
  return value.split(/\\s+|@/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export function SettingsView({
  user,
  darkMode,
  onTheme,
  onStartWalkthrough,
  onDeleteAccount,
}: {
  user: { name: string; email: string };
  darkMode: boolean;
  onTheme: () => void;
  onStartWalkthrough: () => void;
  onDeleteAccount: () => void;
}) {
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportMessage, setExportMessage] = useState("");

  async function sendPasswordReset() {
    setPasswordBusy(true);
    setPasswordMessage("");
    const { error } = await createClient().auth.resetPasswordForEmail(
      user.email,
      {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent("/auth/reset-password")}`,
      },
    );
    setPasswordBusy(false);
    setPasswordMessage(
      error
        ? "Could not send the reset email. Please try again."
        : "Password-reset email sent.",
    );
  }
  async function exportData() {
    setExportBusy(true);
    setExportMessage("");
    try {
      const response = await fetch("/api/account/export", { cache: "no-store" });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] || "marginalia-data.json";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setExportMessage("Your archive was downloaded.");
    } catch {
      setExportMessage("Could not export your data. Please try again.");
    } finally {
      setExportBusy(false);
    }
  }
  return (
    <>
      <div className="page-title">
        <div>
          <div className="kicker">Account</div>
          <h2>Settings</h2>
          <p>Manage your workspace preferences and account information.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="card settings-card">
          <div>
            <h3>Profile</h3>
            <p>Your identity is managed securely through Supabase Auth.</p>
          </div>
          <div className="settings-profile">
            <span>{initials(user.name || user.email)}</span>
            <div>
              <strong>{user.name || "Researcher"}</strong>
              <small>{user.email}</small>
            </div>
          </div>
        </section>
        <section className="card settings-card">
          <div><h3>Your data</h3><p>Download a machine-readable copy of your complete Marginalia workspace.</p></div>
          <button className="setting-row" onClick={exportData} disabled={exportBusy}>
            <span className="setting-icon"><Download size={17} /></span>
            <span><strong>{exportBusy ? "Preparing archive…" : "Export my data"}</strong><small>Projects, sources, citation metadata, contributors, tags, excerpts, notes, and relationships</small></span>
            <ArrowRight size={15} />
          </button>
          {exportMessage && <p className="settings-action-message" role="status">{exportMessage}</p>}
        </section>
        <section className="card settings-card">
          <div>
            <h3>Security</h3>
            <p>Change your password through a secure link sent to your account email.</p>
          </div>
          <button className="setting-row" onClick={sendPasswordReset} disabled={passwordBusy}>
            <span className="setting-icon"><KeyRound size={17} /></span>
            <span>
              <strong>{passwordBusy ? "Sending…" : "Reset password"}</strong>
              <small>{passwordMessage || "Send a password-reset email"}</small>
            </span>
            <ArrowRight size={15} />
          </button>
        </section>
        <section className="card settings-card">
          <div>
            <h3>Appearance</h3>
            <p>Choose how Marginalia looks on this device.</p>
          </div>
          <button className="setting-row" onClick={onTheme}>
            <span className="setting-icon">
              {darkMode ? <Moon size={17} /> : <Sun size={17} />}
            </span>
            <span>
              <strong>Dark mode</strong>
              <small>
                {darkMode
                  ? "Dark appearance is enabled"
                  : "Light appearance is enabled"}
              </small>
            </span>
            <span className={`toggle ${darkMode ? "on" : ""}`}>
              <i />
            </span>
          </button>
        </section>
        <section className="card settings-card settings-tour-card">
          <div>
            <h3>Getting started</h3>
            <p>Take a guided tour of the workspace and browser extension.</p>
          </div>
          <button className="setting-row" onClick={onStartWalkthrough}>
            <span className="setting-icon">
              <BookOpen size={17} />
            </span>
            <span>
              <strong>App walkthrough</strong>
              <small>About 2 minutes · 10 steps</small>
            </span>
            <ArrowRight size={15} />
          </button>
        </section>
        <section className="card settings-card">
          <div><h3>Help and feedback</h3><p>Get support or tell us when something does not work as expected.</p></div>
          <a className="setting-row" href={`mailto:${supportEmail}?subject=Marginalia%20beta%20feedback`}>
            <span className="setting-icon"><MessageSquareWarning size={17} /></span>
            <span><strong>Report a problem</strong><small>Include what you were doing and what happened</small></span><ArrowRight size={15} />
          </a>
          <a className="setting-row" href={`mailto:${supportEmail}`}>
            <span className="setting-icon"><LifeBuoy size={17} /></span>
            <span><strong>Contact support</strong><small>{supportEmail}</small></span><ArrowRight size={15} />
          </a>
          <p className="settings-version">Marginalia beta · version {packageJson.version}</p>
        </section>
        <section className="card settings-card">
          <div><h3>Legal</h3><p>Review the current beta policy and service-term placeholders.</p></div>
          <Link className="setting-row" href="/privacy"><span className="setting-icon"><FileText size={17} /></span><span><strong>Privacy Policy</strong><small>Draft awaiting owner-approved legal copy</small></span><ArrowRight size={15} /></Link>
          <Link className="setting-row" href="/terms"><span className="setting-icon"><FileText size={17} /></span><span><strong>Terms of Service</strong><small>Draft awaiting owner-approved legal copy</small></span><ArrowRight size={15} /></Link>
        </section>
        <section className="card settings-card settings-danger-card">
          <div><h3>Delete account</h3><p>Permanently remove your account and all projects, sources, excerpts, and tags.</p></div>
          <button className="setting-row danger" onClick={onDeleteAccount}>
            <span className="setting-icon"><Trash2 size={17} /></span><span><strong>Delete account</strong><small>This cannot be undone</small></span><ArrowRight size={15} />
          </button>
        </section>
      </div>
    </>
  );
}
