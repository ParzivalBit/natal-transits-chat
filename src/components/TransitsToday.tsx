// src/components/TransitsToday.tsx
import React from 'react';
import { headers, cookies } from 'next/headers';

type TransitItem = {
  date: string;
  t_planet: string;
  n_point: string;
  aspect: string;   // 'conjunction' | 'sextile' | ...
  orb: number;
  score: number;
};

function todayISO(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function ymOfToday(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

function symbolForAspect(a: string): string {
  switch (a) {
    case 'conjunction': return '☌';
    case 'sextile':     return '✶';
    case 'square':      return '□';
    case 'trine':       return '△';
    case 'opposition':  return '☍';
    default:            return a;
  }
}

export default async function TransitsToday() {
  const date = todayISO();
  const ym = ymOfToday();

  // Costruiamo un URL assoluto basandoci sugli header della richiesta
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const baseUrl = `${proto}://${host}`;

  const res = await fetch(`${baseUrl}/api/transits?date=${date}`, {
    cache: 'no-store',
    headers: { cookie: cookies().toString() }, // mantiene la sessione → niente 401
  });

  if (!res.ok) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-red-700">Errore nel calcolo dei transiti ({res.status}).</div>
        <a
          href={`/dashboard/transits/month?ym=${ym}`}
          className="inline-block rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
        >
          Vedi mese
        </a>
      </div>
    );
  }

  const data = (await res.json()) as { ok?: boolean; top?: TransitItem[]; error?: string };

  if (!data.ok || !data.top || data.top.length === 0) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-gray-600">Nessun transito rilevante per oggi.</div>
        <a
          href={`/dashboard/transits/month?ym=${ym}`}
          className="inline-block rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
        >
          Vedi mese
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-700">Stai vedendo i</span>
        <span className="text-xs rounded-full bg-gray-100 px-2 py-1 text-gray-700">Top 5</span>
      </div>

      <ul className="space-y-3">
        {data.top.map((t, idx) => (
          <li key={`${t.t_planet}-${t.n_point}-${idx}`} className="rounded-xl border p-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">
                {t.t_planet} {symbolForAspect(t.aspect)} {t.n_point}
              </div>
              <div className="text-xs text-gray-500">
                orb {t.orb.toFixed(1)}° • score {Math.round(t.score)}
              </div>
            </div>
            <div className="text-xs text-gray-600">Date: {t.date}</div>
          </li>
        ))}
      </ul>

      <div>
        <a
          href={`/dashboard/transits/month?ym=${ym}`}
          className="inline-block rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
        >
          Vedi tutti i transiti del mese
        </a>
      </div>
    </div>
  );
}
