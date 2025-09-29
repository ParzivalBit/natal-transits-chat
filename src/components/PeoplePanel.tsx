// src/components/PeoplePanel.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export type HouseSystem = 'placidus' | 'whole';

export type PersonFormState = {
  id?: string;
  label?: string | null;
  birth_date?: string | null;              // 'YYYY-MM-DD'
  birth_time?: string | null;              // 'HH:MM' | null
  birth_tz_offset_minutes?: number | null; // (non usato qui)
  birth_lat?: number | null;
  birth_lon?: number | null;
};

type PeoplePanelProps = {
  houseSystem?: HouseSystem;               // opzionale: default 'placidus'
  defaultPerson?: PersonFormState | null;
};

type CreateResp = { ok?: boolean; id?: string; error?: string };
type CuspsResp =
  | { ok: true; count: number; system: HouseSystem; approx: string | null }
  | { error: string; stage?: string };

export default function PeoplePanel({ houseSystem = 'placidus', defaultPerson }: PeoplePanelProps) {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [form, setForm] = useState<PersonFormState>({
    id: defaultPerson?.id,
    label: defaultPerson?.label ?? '',
    birth_date: defaultPerson?.birth_date ?? '',
    birth_time: defaultPerson?.birth_time ?? '',
    birth_tz_offset_minutes: defaultPerson?.birth_tz_offset_minutes ?? 0,
    birth_lat: defaultPerson?.birth_lat ?? 0,
    birth_lon: defaultPerson?.birth_lon ?? 0,
  });

  const set = <K extends keyof PersonFormState>(k: K, v: PersonFormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOkMsg(null);

    try {
      // 1) Crea persona + semina punti/aspetti (riempie people_chart_points)
      const res = await fetch('/api/people', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ 
          label: form.label || '',
          date: form.birth_date || '',
          time: form.birth_time || null,
          lat: form.birth_lat != null ? Number(form.birth_lat) : null,
          lon: form.birth_lon != null ? Number(form.birth_lon) : null,
        }),
      });
      const js = (await res.json()) as CreateResp;
      if (!res.ok || !js.ok || !js.id) {
        throw new Error(js.error || `HTTP ${res.status}`);
      }
      const personId = js.id;
      setForm((s) => ({ ...s, id: personId }));


      // 2) Cuspidi (con fallback solare; se manca ASC e manca Sun in tabella lo approssima)
      const cuRes = await fetch('/api/people/house-cusps/upsert?solar=1', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ person_id: personId, system: houseSystem }),
      });
      const cuJson = (await cuRes.json()) as CuspsResp;
      if (!cuRes.ok || 'error' in cuJson) {
        throw new Error(('error' in cuJson ? cuJson.error : `HTTP ${cuRes.status}`));
      }

      const ok = cuJson as Extract<CuspsResp, { ok: true }>;
      setOkMsg(`Cuspidi salvate: ${ok.count} (${ok.system}${ok.approx ? ', ' + ok.approx : ''})`);

            // 2.5) Calcolo sinastria + persistenza (NON bloccare la UX se fallisce)
      try {
        await fetch('/api/synastry/compute?persist=1', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ person_id: personId }),
        });
      } catch (e) {
        // Log silenzioso: la pagina /lab/people-pro/[id] ricalcolerà comunque on-load
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[synastry/compute] non critico:', e);
        }
      }

      // 3) Redirect alla pagina sinastria
      router.push(`/lab/people-pro/${personId}`);
    } catch (err) {
      setError((err as Error)?.message ?? 'Errore inatteso');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Nome/Etichetta</span>
          <input
            type="text"
            value={form.label ?? ''}
            onChange={(e) => set('label', e.target.value)}
            className="rounded border px-2 py-1"
            placeholder="Es. Mario Rossi"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Data (YYYY-MM-DD)</span>
          <input
            type="date"
            value={form.birth_date ?? ''}
            onChange={(e) => set('birth_date', e.target.value)}
            className="rounded border px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Ora (HH:MM, opzionale)</span>
          <input
            type="time"
            value={form.birth_time ?? ''}
            onChange={(e) => set('birth_time', e.target.value)}
            className="rounded border px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Latitudine</span>
          <input
            type="number"
            step="0.000001"
            value={form.birth_lat ?? 0}
            onChange={(e) => set('birth_lat', Number(e.target.value))}
            className="rounded border px-2 py-1"
            placeholder="es. 45.4642"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Longitudine</span>
          <input
            type="number"
            step="0.000001"
            value={form.birth_lon ?? 0}
            onChange={(e) => set('birth_lon', Number(e.target.value))}
            className="rounded border px-2 py-1"
            placeholder="es. 9.1900"
          />
        </label>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-black px-3 py-1.5 text-white text-sm disabled:opacity-50"
        >
          {saving ? 'Salvataggio…' : 'Salva persona'}
        </button>
        {okMsg && <span className="text-sm text-emerald-700">{okMsg}</span>}
        {error && <span className="text-sm text-rose-700">{error}</span>}
      </div>
    </form>
  );
}