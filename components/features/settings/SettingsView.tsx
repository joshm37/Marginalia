"use client";

import { ArrowRight, BookOpen, Moon, Sun } from "lucide-react";

function initials(value: string) {
  return value.split(/\\s+|@/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export function SettingsView({
  user,
  darkMode,
  onTheme,
  onStartWalkthrough,
}: {
  user: { name: string; email: string };
  darkMode: boolean;
  onTheme: () => void;
  onStartWalkthrough: () => void;
}) {
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
      </div>
    </>
  );
}

