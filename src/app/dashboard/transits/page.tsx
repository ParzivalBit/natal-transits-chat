// src/app/dashboard/transits/page.tsx
import { createSupabaseServerComponentClient } from '@/lib/supabaseServer';
import dynamicImport from 'next/dynamic';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type HouseSystem = 'placidus' | 'whole';

type ChartPoint = {
  name: string;
  longitude: number;
  sign?: string;
  house?: number | null;
  retro?: boolean;
};

type Props = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

// Componenti client
const ChartWheel = dynamicImport<{
  points: ChartPoint[];
  houseCusps?: number[];
  mcDeg?: number;
  orientation?: 'by-asc' | 'by-mc';
  showHouseNumbers?: boolean;
  showZodiacRing?: boolean;
  size?: number;
  className?: string;
}>(() => import('@/components/ChartWheel'), { ssr: false });

const ChatUI = dynamicImport(() => import('@/components/ChatUI'), { ssr: false });
const HouseSystemSwitcher = dynamicImport(() => import('@/components/HouseSystemSwitcher'), { ssr: false });

// Pianeti di transito (runtime) — usa la tua API
import { computePlanetsAtUTC, type RuntimePoint } from '@/lib/planets/runtime';

// ----------------- util locali

function has12(arr: unknown[] | null | undefined): arr is number[] {
  return !!arr && arr.length === 12 && arr.every(v => Number.isFinite(Number(v)));
}

function zodiacSignFromLon(lon: number): string {
  const signs = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
  const idx = Math.floor((((lon % 360) + 360) % 360) / 30);
  return signs[idx];
}

// aspetto (maggiore) più vicino e distanza in gradi
function nearestMajorAspectDelta(d: number): { aspect: number | null; delta: number } {
  const majors = [0, 60, 90, 120, 180];
  let best: number | null = null;
  let min = 999;
  for (const a of majors) {
    const diff = Math.abs(((d - a + 540) % 360) - 180);
    if (diff < min) { min = diff; best = a; }
  }
  return { aspect: best, delta: min };
}

// punteggio semplice: più è stretto l’orbe, più alto
function scoreAspect(planet: string, aspect: number | null, orb: number): number {
  if (aspect === null) return 0;
  const baseOrb =
    planet === 'Sun' || planet === 'Moon' ? 6 :
    planet === 'Mercury' || planet === 'Venus' ? 4 :
    planet === 'Mars' ? 4 :
    3.5;
  const maxOrb =
    aspect === 0 ? baseOrb + 1.0 :
    aspect === 180 ? baseOrb + 0.5 :
    baseOrb;
  const v = Math.max(0, maxOrb - orb);
  const w =
    aspect === 0 ? 1.05 :
    aspect === 180 ? 1.02 :
    aspect === 120 ? 1.00 :
    aspect === 90 ? 0.98 :
    aspect === 60 ? 0.95 : 0.9;
  return v * w;
}

export default async function Page({ searchParams }: Props) {
  const supabase = createSupabaseServerComponentClient();
  const auth = await supabase.auth.getUser();
  const userId = auth.data.user?.id ?? null;
  if (!userId) redirect('/onboarding');

  // 1) Data selezionata (default: oggi UTC)
  const dParam = typeof searchParams?.d === 'string' ? searchParams!.d : undefined;
  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(today.getUTCDate()).padStart(2, '0');
  const dateUTC = dParam ?? `${yyyy}-${mm}-${dd}`;            // "YYYY-MM-DD"
  const dateObjUTC = new Date(`${dateUTC}T00:00:00Z`);        // mezzanotte UTC

  // 2) Sistema case preferito
  const { data: prefs } = await supabase
    .from('user_prefs')
    .select('house_system')
    .eq('user_id', userId)
    .maybeSingle();

  const system: HouseSystem = prefs?.house_system === 'placidus' ? 'placidus' : 'whole';

  // 3) Cuspidi natalizie (schema verticale)
  const { data: cuspsRows } = await supabase
    .from('house_cusps')
    .select('cusp, longitude')
    .eq('user_id', userId)
    .eq('system', system)
    .order('cusp', { ascending: true });

  const houseCusps = Array.isArray(cuspsRows) && cuspsRows.length === 12
    ? cuspsRows.map(r => Number(r.longitude))
    : undefined;

  const mcDeg = has12(houseCusps) ? houseCusps[9] : undefined;

  // 4) Punti natali (per aspetto con transiti)
  const { data: natalRows } = await supabase
    .from('chart_points')
    .select('name, longitude')
    .eq('user_id', userId)
    .order('name', { ascending: true });

  const natalPoints: ChartPoint[] = Array.isArray(natalRows)
    ? natalRows.map(r => ({ name: r.name, longitude: Number(r.longitude) }))
    : [];

  // 5) Pianeti di transito (runtime) per la data selezionata
  const transitRaw: RuntimePoint[] = computePlanetsAtUTC(dateObjUTC);
  const transitPoints: ChartPoint[] = transitRaw.map((p) => ({
    name: p.name,
    longitude: Number(p.longitude),
    retro: !!p.retro,
    sign: zodiacSignFromLon(Number(p.longitude)),
    house: null,
  }));

  // 6) Top 3 transiti del giorno
  type TransitHit = { planet: string; target: string; aspect: number; orb: number; score: number };
  const hits: TransitHit[] = [];
  for (const tp of transitPoints) {
    for (const np of natalPoints) {
      const d = Math.abs(((tp.longitude - np.longitude + 540) % 360) - 180);
      const { aspect, delta } = nearestMajorAspectDelta(d);
      const score = scoreAspect(String(tp.name), aspect, delta);
      if (score > 0.5 && aspect !== null) {
        hits.push({
          planet: String(tp.name),
          target: String(np.name),
          aspect,
          orb: Number(delta),
          score,
        });
      }
    }
  }
  hits.sort((a, b) => b.score - a.score);
  const top3 = hits.slice(0, 3);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Colonna sinistra */}
      <div className="rounded-2xl border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Transits</h2>
          <HouseSystemSwitcher current={system} />
        </div>

        {/* Date picker */}
        <form className="mb-4" action="/dashboard/transits" method="get">
          <label className="text-xs text-gray-600 mr-2">Date (UTC):</label>
          <input
            type="date"
            name="d"
            defaultValue={dateUTC}
            className="border rounded-md px-2 py-1 text-sm"
          />
          <button
            type="submit"
            className="ml-2 px-3 py-1 text-sm rounded-md border bg-white hover:bg-gray-50"
          >
            Go
          </button>
        </form>

        {/* Ruota: transiti + case natalizie utente */}
        <div className="mb-4">
          <ChartWheel
            key={`${system}-${(houseCusps?.[0] ?? 0).toFixed(3)}-${dateUTC}`}
            points={transitPoints}
            houseCusps={houseCusps}
            mcDeg={mcDeg}
            orientation="by-asc"
            showZodiacRing
            showHouseNumbers
            size={460}
          />
        </div>

        {/* Top 3 transiti */}
        <div>
          <h3 className="text-sm font-semibold mb-2">Top transits for {dateUTC}</h3>
          {top3.length === 0 ? (
            <p className="text-sm text-gray-600">Nessun aspetto rilevante nei range di orb impostati.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {top3.map((t, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span>
                    <span className="font-medium">{t.planet}</span>{' '}
                    {t.aspect === 0 && 'conj.'}
                    {t.aspect === 60 && 'sext.'}
                    {t.aspect === 90 && 'sq.'}
                    {t.aspect === 120 && 'trine'}
                    {t.aspect === 180 && 'opp.'}{' '}
                    <span className="font-medium">{t.target}</span>
                  </span>
                  <span className="text-xs text-gray-500">orb {t.orb.toFixed(2)}°</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Colonna destra: Chat */}
      <div className="rounded-2xl border p-4 min-h-[480px]">
        <h2 className="text-lg font-semibold mb-3">Ask about today</h2>
        <ChatUI />
      </div>
    </div>
  );
}
