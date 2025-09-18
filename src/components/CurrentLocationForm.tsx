// src/components/CurrentLocationForm.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

type ResolvePayload = {
  display_name: string;
  lat: number;
  lon: number;
  city: string | null;
  state: string | null;
  country: string | null;
  timezone: string | null;
  tz_offset_minutes: number | null;
};

type ResolveResult = {
  ok: boolean;
  query?: string;
  result?: ResolvePayload;
  error?: string;
};

export type CurrentLocationInitial = {
  place_name?: string | null;
  lat?: number | null;
  lon?: number | null;
  tz_name?: string | null;
};

export default function CurrentLocationForm(props: { initial?: CurrentLocationInitial }) {
  const { initial } = props;

  const [query, setQuery] = useState<string>(initial?.place_name ?? '');
  const [resolved, setResolved] = useState<ResolveResult | null>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const haveSaved =
    typeof initial?.lat === 'number' &&
    typeof initial?.lon === 'number' &&
    !!initial?.place_name;

  const canResolve = useMemo(() => query.trim().length >= 2, [query]);

  useEffect(() => {
    setResolved(null);
    setMsg(null);
    setErr(null);
  }, [query]);

  async function resolvePlace() {
    if (!canResolve) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const r = await fetch(`/api/geo/resolve?q=${encodeURIComponent(query.trim())}`);
      const j = (await r.json()) as ResolveResult;
      if (!j.ok || !j.result) throw new Error(j.error || 'Place not found');
      setResolved(j);
      setMsg(`Resolved: ${j.result.display_name} ${j.result.timezone ? `(${j.result.timezone})` : ''}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Resolve error');
    } finally {
      setBusy(false);
    }
  }

  const canSave = useMemo(() => {
    if (resolved?.ok && resolved.result) return true;
    return haveSaved;
  }, [resolved, haveSaved]);

  async function savePrefs() {
    if (!canSave) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      // usa i dati risolti se presenti, altrimenti quelli salvati
      const payload = resolved?.result
        ? {
            place_name: resolved.result.display_name,
            lat: resolved.result.lat,
            lon: resolved.result.lon,
            tz_name: resolved.result.timezone ?? null,
          }
        : {
            place_name: initial?.place_name ?? '',
            lat: (initial?.lat ?? null) as number | null,
            lon: (initial?.lon ?? null) as number | null,
            tz_name: initial?.tz_name ?? null,
          };

      const resp = await fetch('/api/user/prefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = (await resp.json()) as { ok?: boolean; error?: string };
      if (!resp.ok || !j.ok) throw new Error(j.error || `Save failed (${resp.status})`);

      setMsg('Current location saved.');
      // opzionale: vai al dashboard
      // window.location.assign('/dashboard');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Save error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <div className="space-y-1">
        <label className="text-xs text-gray-600">Current city (for transits)</label>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border px-3 py-2 text-sm"
            placeholder="City, Country"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="button"
            className="rounded border px-3 py-2 text-sm"
            onClick={resolvePlace}
            disabled={!canResolve || busy}
            title="Resolve with Nominatim"
          >
            {busy ? 'Resolving…' : 'Resolve'}
          </button>
        </div>

        {resolved?.ok && resolved.result ? (
          <div className="text-xs text-green-700">
            Resolved: {resolved.result.display_name}{' '}
            {resolved.result.timezone ? `(${resolved.result.timezone})` : ''}
          </div>
        ) : haveSaved ? (
          <div className="text-xs text-gray-600">
            Using saved place: {initial?.place_name}
            {initial?.tz_name ? ` (${initial.tz_name})` : ''}
          </div>
        ) : (
          <div className="text-xs text-gray-500">Use Resolve to select a valid place.</div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={savePrefs}
          disabled={!canSave || busy}
          className="rounded border px-3 py-2 text-sm bg-blue-600 text-white disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save current location'}
        </button>
      </div>

      {msg && <div className="text-green-700 text-sm">{msg}</div>}
      {err && <div className="text-red-700 text-sm">{err}</div>}

      <p className="text-xs text-gray-500">
        Wellness/entertainment only; not a substitute for medical, legal, or financial advice.
      </p>
    </div>
  );
}
