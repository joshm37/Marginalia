"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setBusy(false);
      setError(updateError.message);
      return;
    }
    await supabase.auth.signOut({ scope: "local" });
    setBusy(false);
    setComplete(true);
  }

  return (
    <main className="auth-page auth-reset-page">
      <section className="auth-panel">
        <div className="auth-brand">
          <span><BookOpen size={20} /></span>
          <strong>Marginalia</strong>
        </div>
        <div>
          <div className="kicker">Account security</div>
          <h1>{complete ? "Password updated." : "Choose a new password."}</h1>
          <p>
            {complete
              ? "Your password has been changed. Sign in again on each device where you use Marginalia."
              : "Use at least eight characters and avoid reusing a password from another service."}
          </p>
        </div>
        {complete ? (
          <button className="btn primary auth-reset-action" onClick={() => router.replace("/login")}>
            Return to sign in <ArrowRight size={15} />
          </button>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            <label>
              New password
              <input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
            </label>
            <label>
              Confirm new password
              <input required minLength={8} type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" />
            </label>
            {error && <div className="auth-message" role="alert">{error}</div>}
            <button className="btn primary" disabled={busy}>
              <KeyRound size={15} /> {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
