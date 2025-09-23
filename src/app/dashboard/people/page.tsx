// src/app/dashboard/people/page.tsx
import { createSupabaseServerComponentClient } from '@/lib/supabaseServer';
import dynamicImport from 'next/dynamic';
import { redirect } from 'next/navigation';
import { computeHouses } from '@/lib/astro';

export const dynamic = 'force-dynamic';

type HouseSystem = 'placidus' | 'whole';

type NatalPoint = { name: string; longitude: number; sign?: string };
type ChartPointRow = { name: string; longitude: number; sign: string | null };

const ChatUI = dynamicImport(() => import('@/components/ChatUI'), { ssr: false });
const PeoplePanel = dynamicImport(() => import('@/components/PeoplePanel'), { ssr: false });
const HouseSystemSwitcher = dynamicImport(() => import('@/components/HouseSystemSwitcher'), { ssr: false });


type CuspsPacket = {
  system: HouseSystem;
  cusps: number[];     // 12 longitudes 0..360
  asc: number;         // cusps[0]
  mc: number;          // cusps[9]
  note?: string | null;
};

function has12(arr: unknown[] | null | undefined): arr is number[] {
  return !!arr && arr.length === 12 && arr.every(v => Number.isFinite(Number(v)));
}

export default async function Page() {
  const supabase = createSupabaseServerComponentClient();

  // --- auth robusto: ricaviamo userId e facciamo redirect se manca
  const auth = await supabase.auth.getUser();
  const userId = auth.data.user?.id ?? null;
  if (!userId) redirect('/onboarding');

  // 1) Sistema preferito (default whole se mancante)
  const { data: prefs } = await supabase
    .from('user_prefs')
    .select('house_system')
    .eq('user_id', userId)
    .single();
  const preferred: HouseSystem = prefs?.house_system === 'placidus' ? 'placidus' : 'whole';

  // Helper: carica 12 cuspidi per un dato sistema (schema verticale: 12 righe cusp/longitude)
  async function loadCuspsFor(system: HouseSystem): Promise<number[] | null> {
    const { data, error } = await supabase
      .from('house_cusps')
      .select('cusp, longitude')
      .eq('user_id', userId)
      .eq('system', system)
      .order('cusp', { ascending: true });
    if (error) return null;
    if (!data || data.length !== 12) return null;
    const arr = data.map(r => Number(r.longitude));
    return has12(arr) ? arr : null;
  }

  // 2) Tenta preferito, poi qualsiasi sistema disponibile come fallback
  let usedSystem: HouseSystem | null = null;
  let cusps: number[] | null = await loadCuspsFor(preferred);
  let note: string | null = null;

  if (cusps) {
    usedSystem = preferred;
  } else {
    // fallback: prendi la prima serie disponibile dell'utente (qualsiasi system)
    const { data: anyRows } = await supabase
      .from('house_cusps')
      .select('system, cusp, longitude')
      .eq('user_id', userId)
      .order('system', { ascending: true })
      .order('cusp', { ascending: true });

    if (anyRows && anyRows.length >= 12) {
      // raggruppa per sistema e prendi il primo con 12 righe
      const bySystem = new Map<string, { cusp: number; longitude: number }[]>();
      for (const r of anyRows) {
        const s = String(r.system);
        const arr = bySystem.get(s) ?? [];
        arr.push({ cusp: Number(r.cusp), longitude: Number(r.longitude) });
        bySystem.set(s, arr);
      }
      for (const [sys, arr] of bySystem.entries()) {
        if (arr.length === 12) {
          arr.sort((a, b) => a.cusp - b.cusp);
          const lons = arr.map(x => x.longitude);
          if (has12(lons)) {
            usedSystem = (sys === 'placidus' ? 'placidus' : 'whole');
            cusps = lons;
            if (usedSystem !== preferred) {
              note = `Cuspidi trovate per il sistema "${usedSystem}". Preferenza corrente: "${preferred}".`;
            }
            break;
          }
        }
      }
    }
  }

  // 3) Se ancora nulla, calcolo runtime da birth_data (senza scrivere su DB)
  if (!cusps) {
    const { data: bd } = await supabase
      .from('birth_data')
      .select('datetime_utc, lat, lon, tz_offset_min')
      .eq('user_id', userId)
      .single();

    if (bd?.datetime_utc && bd.lat != null && bd.lon != null) {
      const dt = new Date(bd.datetime_utc as string);
      const jd = 2440587.5 + dt.getTime() / 86400000;
      const houses = computeHouses(preferred, {
        jd,
        latDeg: Number(bd.lat),
        lonDeg: Number(bd.lon),
        tzMinutes: Number(bd.tz_offset_min ?? 0),
      });
      cusps = houses.cusps;
      usedSystem = preferred;
      note = `Cuspidi calcolate runtime da birth_data (non trovate in house_cusps).`;
    }
  }

  // 4) Se proprio nulla, mostriamo CTA onboarding
  let packet: CuspsPacket | null = null;
  if (cusps && usedSystem) {
    packet = {
      system: usedSystem,
      cusps,
      asc: cusps[0],   // cusp 1 = ASC (eclittica)
      mc: cusps[9],    // cusp 10 = MC (eclittica)
      note,
    };
  }

  // Punti natali del consultante (per sinastria/overlay nel pannello)
  const { data: natalPointsRaw } = await supabase
    .from('chart_points')
    .select('name, longitude, sign')
    .eq('user_id', userId)
    .order('name', { ascending: true });

  const natalPoints: NatalPoint[] = Array.isArray(natalPointsRaw)
    ? (natalPointsRaw as ChartPointRow[]).map((p) => ({
        name: p.name,
        longitude: Number(p.longitude),
        sign: p.sign ?? undefined,
      }))
    : [];

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="rounded-2xl border p-4">
        <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">People / Sinastria</h2>
          <HouseSystemSwitcher current={packet?.system ?? 'whole'} />
        </div>
        {!packet ? (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Completa i dati di nascita</h2>
            <p className="text-sm text-gray-600">
              Per usare la sinastria abbiamo bisogno del tuo tema natale (cuspidi delle case).
            </p>
            <a
              href="/onboarding"
              className="inline-block px-3 py-2 text-sm rounded-md bg-blue-600 text-white"
            >
              Vai a Onboarding
            </a>
          </div>
        ) : (
          <>
            {packet.note && (
              <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 text-amber-800 text-xs px-3 py-2">
                {packet.note}
              </div>
            )}
            <div className="text-xs text-gray-500 mb-2">
              ASC natal: {packet.asc.toFixed(2)}° · MC natal: {packet.mc.toFixed(2)}° · Sistema: {packet.system}
            </div>
            <PeoplePanel
              system={packet.system}
              natalCusps={packet.cusps}
              natalAsc={packet.asc}
              natalMc={packet.mc}
              natalPoints={natalPoints}
            />
          </>
        )}
      </div>

      <div className="rounded-2xl border p-4 min-h-[480px]">
        <h2 className="text-lg font-semibold mb-3">Ask about compatibility</h2>
        <ChatUI />
      </div>
    </div>
  );
}
