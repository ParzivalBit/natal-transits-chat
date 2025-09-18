'use client';

import { useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabaseBrowser';

export default function AuthForm() {
  const supabase = createSupabaseBrowser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loadingAction, setLoadingAction] = useState<'signup' | 'signin' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function doSignUp() {
    if (!email || !password) { setErr('Email and password required.'); return; }
    setLoadingAction('signup'); setErr(null); setMsg(null);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // ← callback "non-API" come da struttura finale
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding%23birth`,
        },
      });
      if (error) throw error;
      setMsg('Check your email to confirm your account. After confirming, you’ll be redirected here.');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Sign up error');
    } finally {
      setLoadingAction(null);
    }
  }

  async function doSignIn() {
    if (!email || !password) { setErr('Email and password required.'); return; }
    setLoadingAction('signin'); setErr(null); setMsg(null);
    try {
      // 1) login client
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // 2) porta i token al server per scrivere i cookie (necessari alle Server Components)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token || !session.refresh_token) throw new Error('No session returned');

      const res = await fetch('/api/auth/set-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`set-session failed (${res.status}): ${txt.slice(0, 120)}`);
      }
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || 'Failed to set server session');

      // 3) forza una NAVIGAZIONE VERA (non solo hash) per ricaricare la Server Component
      const target = `/onboarding?ts=${Date.now()}#birth`;
      window.location.assign(target);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Sign in error');
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <h2 className="font-medium">Create or access your account</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)} />
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <button
          className="rounded border px-3 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700"
          onClick={doSignUp}
          disabled={loadingAction !== null}
        >
          {loadingAction === 'signup' ? 'Signing up…' : 'Sign up'}
        </button>
        <button
          className="rounded border px-3 py-2 text-sm"
          onClick={doSignIn}
          disabled={loadingAction !== null}
        >
          {loadingAction === 'signin' ? 'Signing in…' : 'Sign in'}
        </button>
      </div>
      {msg && <div className="text-green-700 text-sm">{msg}</div>}
      {err && <div className="text-red-700 text-sm">{err}</div>}
      <p className="text-xs text-gray-500">
        We’ll store your chart and chat history securely. You can delete data anytime.
      </p>
    </div>
  );
}
