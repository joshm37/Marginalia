"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Bookmark,
  FolderOpen,
  Highlighter,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState(() =>
    search.get("error") === "confirmation_failed"
      ? "That confirmation link is invalid or expired. Please try again."
      : "",
  );
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    if (process.env.NEXT_PUBLIC_E2E_TEST_MODE === "true") {
      router.replace("/");
      router.refresh();
      return;
    }
    const supabase = createClient();
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: name },
              emailRedirectTo: `${location.origin}/auth/callback`,
            },
          });
    setBusy(false);
    if (result.error) return setError(result.error.message);
    if (mode === "signup" && !result.data.session)
      return setError("Check your email to confirm your account.");
    const requestedPath = search.get("next");
    const destination =
      requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
        ? requestedPath
        : "/";
    router.replace(destination);
    router.refresh();
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-brand">
          <span>
            <BookOpen size={20} />
          </span>
          <strong>Marginalia</strong>
        </div>
        <div>
          <div className="kicker">Your research, connected</div>
          <h1>
            {mode === "login" ? "Welcome back." : "Create your workspace."}
          </h1>
          <p>
            {mode === "login"
              ? "Sign in to return to your sources, excerpts, and projects."
              : "Start building a research library that follows you across the web."}
          </p>
        </div>
        <form onSubmit={submit} className="auth-form">
          {mode === "signup" && (
            <label>
              Full name
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </label>
          )}
          <label>
            Email address
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              required
              minLength={8}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </label>
          {error && <div className="auth-message">{error}</div>}
          <button className="btn primary" disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
            {!busy && <ArrowRight size={15} />}
          </button>
        </form>
        <button
          className="auth-switch"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError("");
          }}
        >
          {mode === "login"
            ? "New to Marginalia? Create an account"
            : "Already have an account? Sign in"}
        </button>
        <div className="auth-assurances" aria-label="Marginalia features">
          <span>
            <Bookmark size={13} /> Save sources
          </span>
          <span>
            <Highlighter size={13} /> Capture excerpts
          </span>
          <span>
            <FolderOpen size={13} /> Build projects
          </span>
        </div>
      </section>
      <aside className="auth-visual">
        <div className="auth-orbit auth-orbit-one" />
        <div className="auth-orbit auth-orbit-two" />
        <div className="auth-visual-topline">
          <span className="auth-live-dot" />
          Your research workspace
        </div>
        <div className="auth-research-stack" aria-hidden="true">
          <article className="auth-source-preview auth-source-back">
            <div className="auth-preview-icon">
              <FolderOpen size={16} />
            </div>
            <div>
              <small>Project</small>
              <strong>Democratic Institutions</strong>
              <span>12 sources · 28 excerpts</span>
            </div>
          </article>
          <article className="auth-source-preview auth-source-front">
            <header>
              <span>
                <BookOpen size={13} /> Journal article
              </span>
              <span className="auth-preview-year">2026</span>
            </header>
            <h2>Notes that stay connected to their source.</h2>
            <p>
              Save the context around every idea, organize it as you read, and
              return to the evidence when it matters.
            </p>
            <div className="auth-highlight-preview">
              <Highlighter size={15} />
              <span>
                “A well-kept margin turns reading into a conversation.”
              </span>
            </div>
            <footer>
              <span>#institutions</span>
              <span>#methodology</span>
            </footer>
          </article>
        </div>
        <div className="auth-quote">
          <blockquote>
            “Research is formalized curiosity. It is poking and prying with a
            purpose.”
          </blockquote>
          <span>— Zora Neale Hurston</span>
        </div>
      </aside>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="auth-page" />}>
      <LoginForm />
    </Suspense>
  );
}
