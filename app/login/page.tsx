'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BookOpen } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    const supabase = createClient();
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: `${location.origin}/auth/callback` } });
    setBusy(false);
    if (result.error) return setError(result.error.message);
    if (mode === 'signup' && !result.data.session) return setError('Check your email to confirm your account.');
    router.replace(search.get('next') || '/'); router.refresh();
  }

  return <main className="auth-page"><section className="auth-panel"><div className="auth-brand"><span><BookOpen size={20}/></span><strong>Marginalia</strong></div><div><div className="kicker">Your research, connected</div><h1>{mode === 'login' ? 'Welcome back.' : 'Create your workspace.'}</h1><p>{mode === 'login' ? 'Sign in to return to your sources, annotations, and projects.' : 'Start building a research library that follows you across the web.'}</p></div><form onSubmit={submit} className="auth-form">{mode === 'signup' && <label>Full name<input required value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>}<label>Email address<input required type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label><label>Password<input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>{error && <div className="auth-message">{error}</div>}<button className="btn primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button></form><button className="auth-switch" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>{mode === 'login' ? 'New to Marginalia? Create an account' : 'Already have an account? Sign in'}</button></section><aside className="auth-visual"><blockquote>“Research is formalized curiosity. It is poking and prying with a purpose.”</blockquote><span>— Zora Neale Hurston</span></aside></main>;
}

export default function LoginPage() {
  return <Suspense fallback={<main className="auth-page"/>}><LoginForm/></Suspense>;
}
