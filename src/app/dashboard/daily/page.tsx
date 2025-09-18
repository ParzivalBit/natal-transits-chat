// src/app/dashboard/daily/page.tsx
import { headers, cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DateTime } from 'luxon';
import { createSupabaseServerComponentClient } from '@/lib/supabaseServer';
import { computePoints, Point as AstroPoint } from '@/lib/astro';
import SkyWheel, { SkyPoint } from '@/components/SkyWheel';
import ChatUI from '@/components/ChatUI';

type AspectKey = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';
type TransitHit = {
  date: string;
  t_planet: string;
  n_point: string;
  aspect: AspectKey;
  orb: number;
  score: number;
};

function buildDailyContext(date: string, hits: TransitHit[]): string {
  const lines = hits.map(
    (t) => `${date}: ${t.t_planet} ${t.aspect} ${t.n_point} (orb ${t.orb}°, score ${t.score})`
  );
  return `CONTEXT_TRANSITS_TODAY
${lines.join('\n')}

Guidelines:
- Focalizza su lavoro/relazioni/energia con scenari realistici.
- Suggerisci 2–3 azioni pratiche legate ai transiti odierni.
- Evita assoluti; tono empatico. Benessere/entertainment.`;
}

export default async function DailyPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const supabase = createSupabaseServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/onboarding');

  // leggi preferenze utente (per tz/lat/lon attuali)
  const { data: prefs } = await supabase
    .from('user_prefs')
    .select('current_city, current_lat, current_lon, current_tz_name')
    .eq('user_id', user.id)
    .maybeSingle();

  const tz = prefs?.current_tz_name ?? 'UTC';

  // data selezionata o oggi nella tz utente
  const now = DateTime.now().setZone(tz);
  const dateISO = (() => {
    const q = searchParams.date;
    if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
    return now.toISODate()!;
  })();

  // frecce prev/next
  const prev = DateTime.fromISO(dateISO, { zone: tz }).minus({ days: 1 }).toISODate()!;
  const next = DateTime.fromISO(dateISO, { zone: tz }).plus({ days: 1 }).toISODate()!;

  // calcolo ruota cielo del giorno (usiamo 09:00 locale per avere ASC/MC se lat/lon presenti)
  const lat = typeof prefs?.current_lat === 'number' ? prefs!.current_lat : null;
  const lon = typeof prefs?.current_lon === 'number' ? prefs!.current_lon : null;
  const { points, houses } = computePoints(tz, dateISO, '09:00', lat, lon);

  const skyPoints: SkyPoint[] = points.map((p: AstroPoint) => ({
    name: p.name,
    longitude: p.longitude,
    sign: p.sign,
    house: p.house,
    retro: p.retro,
  }));

  // fetch transiti del giorno (per il contesto chat)
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const base = `${proto}://${host}`;
  const trRes = await fetch(`${base}/api/transits?date=${dateISO}&limit=7`, {
    cache: 'no-store',
    headers: { cookie: cookies().toString() },
  });

  let hits: TransitHit[] = [];
  if (trRes.ok) {
    const j = (await trRes.json()) as { ok?: boolean; top?: TransitHit[] };
    if (j.ok && Array.isArray(j.top)) hits = j.top;
  }

  const ctx = buildDailyContext(dateISO, hits);

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Colonna sinistra (2/3): controlli + ruota + lista transiti rapida */}
        <div className="xl:col-span-2 space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <a
                href={`/dashboard/daily?date=${prev}`}
                className="rounded-lg border px-3 py-1 hover:bg-gray-50"
                title="Giorno precedente"
              >
                ◀
              </a>
              <a
                href={`/dashboard/daily?date=${next}`}
                className="rounded-lg border px-3 py-1 hover:bg-gray-50"
                title="Giorno successivo"
              >
                ▶
              </a>
            </div>

            <form method="get" className="flex items-center gap-2">
              <input
                type="date"
                name="date"
                defaultValue={dateISO}
                className="rounded-lg border px-3 py-1 text-sm"
              />
              <button className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50">
                Vai
              </button>
            </form>
          </header>

          <SkyWheel
            title={`Mappa del cielo · ${dateISO} ${houses ? '(con ASC/MC)' : ''}`}
            points={skyPoints}
          />

          {/* Top transiti del giorno (preview) */}
          <div className="rounded-2xl border p-4">
            <div className="mb-2 text-sm font-medium">Top transiti di oggi</div>
            {hits.length === 0 ? (
              <div className="text-sm text-gray-600">Nessun transito rilevante rilevato.</div>
            ) : (
              <ul className="space-y-2 text-sm">
                {hits.map((t, i) => (
                  <li key={`${t.t_planet}-${t.n_point}-${i}`} className="flex items-center justify-between">
                    <div>
                      {t.t_planet} {t.aspect} {t.n_point}
                    </div>
                    <div className="text-xs text-gray-500">
                      orb {t.orb.toFixed(1)}° · score {Math.round(t.score)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Colonna destra (1/3): Chat sticky con contesto del giorno */}
        <div className="xl:col-span-1">
          <div className="sticky top-6 h-[75vh]">
            <ChatUI initialContext={ctx} />
          </div>
        </div>
      </div>
    </div>
  );
}
