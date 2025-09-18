// src/app/dashboard/transits/month/page.tsx
import { headers, cookies } from 'next/headers';

type AspectKey = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';

type TransitHit = {
  date: string;
  t_planet: string;
  n_point: string;
  aspect: AspectKey;
  orb: number;
  score: number;
};

type DayBucket = { date: string; items: TransitHit[] };

function symbolForAspect(a: AspectKey): string {
  switch (a) {
    case 'conjunction': return '☌';
    case 'sextile':     return '✶';
    case 'square':      return '□';
    case 'trine':       return '△';
    case 'opposition':  return '☍';
  }
}

export default async function TransitsMonthPage({
  searchParams,
}: {
  searchParams: { ym?: string; mode?: string; limit?: string };
}) {
  const ym = searchParams.ym ?? new Date().toISOString().slice(0, 7);
  const mode = (searchParams.mode ?? 'top') as 'top' | 'all';
  const limit = searchParams.limit ?? '5';

  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const base = `${proto}://${host}`;

  const res = await fetch(`${base}/api/transits/month?ym=${ym}&mode=${mode}&limit=${limit}`, {
    cache: 'no-store',
    headers: { cookie: cookies().toString() },
  });

  if (!res.ok) {
    return (
      <div className="p-6">
        <div className="rounded-xl border p-4 text-sm text-red-700">
          Errore nel calcolo dei transiti mensili ({res.status}).
        </div>
      </div>
    );
  }

  const json = (await res.json()) as { ok?: boolean; days?: DayBucket[]; error?: string };

  if (!json.ok) {
    return (
      <div className="p-6">
        <div className="rounded-xl border p-4 text-sm text-red-700">
          {json.error ?? 'Errore sconosciuto.'}
        </div>
      </div>
    );
  }

  const days = json.days ?? [];

  if (days.length === 0) {
    return (
      <div className="p-6">
        <div className="rounded-xl border p-4 text-sm text-gray-600">
          Nessun transito rilevante in {ym}.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Transiti di {ym}</h1>
        <div className="flex items-center gap-2 text-sm">
          <a
            className={`rounded-lg border px-3 py-1 ${mode === 'top' ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'}`}
            href={`/dashboard/transits/month?ym=${ym}&mode=top&limit=${limit}`}
          >
            Top {limit}
          </a>
          <a
            className={`rounded-lg border px-3 py-1 ${mode === 'all' ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'}`}
            href={`/dashboard/transits/month?ym=${ym}&mode=all`}
          >
            Tutti
          </a>
        </div>
      </header>

      <div className="space-y-5">
        {days.map(({ date, items }) => (
          <section key={date} id={date} className="rounded-2xl border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">{date}</h2>
              {/* Placeholder per bottoni calendario (li aggiungeremo nello step successivo) */}
              <div className="text-xs text-gray-500">{items.length} aspetti</div>
            </div>

            <ul className="space-y-3">
              {items.map((t, idx) => (
                <li key={`${date}-${t.t_planet}-${t.n_point}-${idx}`} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">
                      {t.t_planet} {symbolForAspect(t.aspect)} {t.n_point}
                    </div>
                    <div className="text-xs text-gray-500">
                      orb {t.orb.toFixed(1)}° • score {Math.round(t.score)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
