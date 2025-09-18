// src/app/dashboard/transits/month/page.tsx
import { headers, cookies } from 'next/headers';
import ChatUI from '@/components/ChatUI';
import MonthTransitsList from '@/components/MonthTransitsList';

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

function buildMonthlyContext(ym: string, days: DayBucket[]): string {
  const lines: string[] = [];
  for (const d of days) {
    for (const t of d.items) {
      lines.push(
        `${d.date}: ${t.t_planet} ${t.aspect} ${t.n_point} (orb ${t.orb}°, score ${t.score})`
      );
    }
  }
  return `MONTH_TRANSITS ${ym}
${lines.join('\n')}

Guidelines:
- Contestualizza i transiti per lavoro/relazioni/energia in modo non-deterministico e pratico.
- Se l'utente cita una data (YYYY-MM-DD), filtra le righe di quel giorno e spiega 2–3 implicazioni utili.
- Evita assoluti; tono empatico. Ricorda il disclaimer benessere/entertainment.`;
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
  const monthlyContext = buildMonthlyContext(ym, days);

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Colonna sinistra (2/3): header + scroller */}
        <div className="xl:col-span-2 space-y-4">
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

          {days.length === 0 ? (
            <div className="rounded-xl border p-4 text-sm text-gray-600">
              Nessun transito rilevante in {ym}.
            </div>
          ) : (
            <MonthTransitsList ym={ym} days={days} />
          )}
        </div>

        {/* Colonna destra (1/3): Chat sticky, altezza fissa */}
        <div className="xl:col-span-1">
          <div className="sticky top-6 h-[75vh]">
            <ChatUI initialContext={monthlyContext} />
          </div>
        </div>
      </div>
    </div>
  );
}
