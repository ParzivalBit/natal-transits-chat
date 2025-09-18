// src/components/BirthForm.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

type ResolveResult = {
  ok: boolean;
  query?: string;
  result?: {
    display_name: string;
    lat: number;
    lon: number;
    city: string | null;
    state: string | null;
    country: string | null;
    timezone: string | null;
    tz_offset_minutes: number | null;
  };
  error?: string;
};

type BirthInitial = {
  name?: string | null;
  date?: string | null;
  time?: string | null;
  place_name?: string | null;
  lat?: number | null;
  lon?: number | null;
  tz_name?: string | null; // opzionale; se assente, la risolviamo
};

export default function BirthForm({ initial }: { initial?: BirthInitial }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [date, setDate] = useState(initial?.date ?? '');
  const [time, setTime] = useState(initial?.time ?? ''); // HH:MM
  const [placeQuery, setPlaceQuery] = useState(initial?.place_name ?? '');
  const [resolved, setResolved] = useState<ResolveResult | null>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Se abbiamo già lat/lon/tz salvati, consideriamo "valida" la location
  const haveSavedPlace =
    !!initial?.place_name &&
    typeof initial?.lat === 'number' &&
    typeof initial?.lon === 'number';

  const canResolve = useMemo(() => placeQuery.trim().length >= 2, [placeQuery]);

  // È valida la place? o è stata risolta ora o abbiamo dati salvati
  const haveValidPlace = useMemo(() => {
    return (
      (resolved?.ok && !!resolved?.result?.timezone) ||
      (haveSavedPlace /* tz verrà ricavata da resolve al bisogno */)
    );
  }, [resolved, haveSavedPlace]);

  const canSubmit = useMemo(() => {
    return (
      name.trim().length > 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      haveValidPlace
    );
  }, [name, date, haveValidPlace]);

  async function resolvePlace() {
    setErr(null); setMsg(null); setResolved(null);
    if (!canResolve) { setErr('Type at least 2 characters for place'); return; }
    const params = new URLSearchParams();
    params.set('q', placeQuery.trim());
    params.set('date', date || '');
    if (time) params.set('time', time);

    const r = await fetch(`/api/geo/resolve?${params.toString()}`);
    const j = (await r.json()) as ResolveResult;
    if (!j.ok || !j.result) {
      setErr(j.error || 'Place not found');
      setResolved(j);
      return;
    }
    setResolved(j);
  }

  async function submit() {
    if (!canSubmit) return;
    setBusy(true); setErr(null); setMsg(null);

    try {
      // Usa i dati "resolved" se presenti; altrimenti i salvati iniziali
      const place = resolved?.result
        ? {
            place_name: resolved.result.display_name,
            lat: resolved.result.lat,
            lon: resolved.result.lon,
            tz_name: resolved.result.timezone || 'UTC',
          }
        : {
            place_name: initial?.place_name ?? placeQuery,
            lat: initial?.lat as number,
            lon: initial?.lon as number,
            tz_name: initial?.tz_name ?? null, // se null, comunque computePoints fallback a 'UTC'
          };

      const body = {
        name,
        date,
        time: time || null,
        ...place,
      };

      const resp = await fetch('/api/chart/compute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await resp.json();
      if (!resp.ok || !j.ok) {
        throw new Error(j.error || `Compute failed (${resp.status})`);
      }

      setMsg('Birth data saved.');
      // Torna alla vista riassunto (rimuoviamo il flag edit)
      window.location.assign('/onboarding#birth');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  // Se l'utente cambia query o data/ora, invalidiamo la risoluzione precedente
  useEffect(() => { setResolved(null); }, [placeQuery, date, time]);

  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs text-gray-600">Full name</label>
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="e.g., Alex Morgan"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-600">Birth date</label>
          <input
            type="date"
            className="w-full rounded border px-3 py-2 text-sm"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-600">Birth time (optional)</label>
          <input
            type="time"
            className="w-full rounded border px-3 py-2 text-sm"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
          <p className="text-xs text-gray-500">
            If unknown, we’ll use a solar chart (no houses/ASC).
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-600">Birthplace</label>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded border px-3 py-2 text-sm"
              placeholder="City, Country"
              value={placeQuery}
              onChange={(e) => setPlaceQuery(e.target.value)}
            />
            <button
              type="button"
              className="rounded border px-3 py-2 text-sm"
              onClick={resolvePlace}
              disabled={!canResolve}
              title="Resolve with Nominatim"
            >
              Resolve
            </button>
          </div>

          {resolved?.ok && resolved.result ? (
            <div className="text-xs text-green-700">
              Resolved: {resolved.result.display_name} ({resolved.result.timezone})
            </div>
          ) : haveSavedPlace ? (
            <div className="text-xs text-gray-600">
              Using saved place: {initial?.place_name || '(unknown)'}
            </div>
          ) : (
            <div className="text-xs text-gray-500">Use Resolve to select a valid place.</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="rounded border px-3 py-2 text-sm bg-blue-600 text-white disabled:opacity-50"
          onClick={submit}
          disabled={!canSubmit || busy}
        >
          {busy ? 'Saving…' : 'Save natal chart'}
        </button>
        <button
          type="button"
          className="rounded border px-3 py-2 text-sm"
          onClick={() => window.location.assign('/onboarding#birth')}
        >
          Cancel
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
