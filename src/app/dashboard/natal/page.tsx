// src/app/dashboard/natal/page.tsx
import { createSupabaseServerComponentClient } from '@/lib/supabaseServer';
import dynamicImport from 'next/dynamic';
import { redirect } from 'next/navigation';
import { computeHouses } from '@/lib/astro';

export const dynamic = 'force-dynamic';

type ChartPoint = {
  name: string;
  longitude: number;
  sign: string;
  house: number | null;
  retro: boolean;
};
type HouseSystem = 'placidus' | 'whole';

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

function has12(arr: unknown[] | null | undefined): arr is number[] {
  return !!arr && arr.length === 12 && arr.every(v => Number.isFinite(Number(v)));
}

export default async function Page() {
  const supabase = createSupabaseServerComponentClient();
  const auth = await supabase.auth.getUser();
  const userId = auth.data.user?.id ?? null;
  if (!userId) redirect('/onboarding');

  // Sistema preferito
  const { data: prefs } = await supabase
    .from('user_prefs')
    .select('house_system')
    .eq('user_id', userId)
    .maybeSingle();

  const system: HouseSystem = prefs?.house_system === 'placidus' ? 'placidus' : 'whole';

  // Cuspidi per il sistema preferito
  const { data: cuspsRows } = await supabase
    .from('house_cusps')
    .select('cusp, longitude')
    .eq('user_id', userId)
    .eq('system', system)
    .order('cusp', { ascending: true });

  let cusps: number[] | null =
    Array.isArray(cuspsRows) && cuspsRows.length === 12
      ? cuspsRows.map(r => Number(r.longitude))
      : null;

  // Fallback runtime da birth_data (se l’utente non ha ancora scritto house_cusps per questo system)
  if (!has12(cusps)) {
    const { data: bd } = await supabase
      .from('birth_data')
      .select('date,time,tz_offset_minutes,lat,lon')
      .eq('user_id', userId)
      .maybeSingle();

    if (bd?.date && bd.time && bd.lat != null && bd.lon != null) {
      // calcolo JD UT semplificato (stesso criterio che usiamo nel route di compute)
      const [hh, mm] = String(bd.time).slice(0, 5).split(':').map(Number);
      const local = new Date(`${bd.date}T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00Z`);
      const tzOff = Number(bd.tz_offset_minutes ?? 0);
      const utcMillis = local.getTime() - tzOff * 60_000;  // local - offset = UTC
      const jd = 2440587.5 + utcMillis / 86_400_000;

      const houses = computeHouses(system, {
        jd,
        latDeg: Number(bd.lat),
        lonDeg: Number(bd.lon),
        tzMinutes: tzOff,
      });
      cusps = houses.cusps;
    } else {
      cusps = null;
    }
  }

  const { data: points } = await supabase
    .from('chart_points')
    .select('name,longitude,sign,house,retro')
    .eq('user_id', userId)
    .order('name', { ascending: true });

  const hasPoints = Array.isArray(points) && points.length > 0;
  const mcDeg = has12(cusps) ? cusps[9] : undefined;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="rounded-2xl border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">
            Natal Chart — {system === 'placidus' ? 'Placidus' : 'Whole Sign'}
          </h2>
          <HouseSystemSwitcher current={system} />
        </div>

        {!hasPoints ? (
          <p className="text-sm text-gray-600">
            Nessun dato. Vai in <span className="font-medium">Onboarding</span> e salva i dati di nascita.
          </p>
        ) : (
          <ChartWheel
            key={`${system}-${has12(cusps) ? cusps[0].toFixed(3) : 'no-cusps'}`}
            points={points as ChartPoint[]}
            houseCusps={has12(cusps) ? cusps : undefined}
            mcDeg={mcDeg}
            orientation="by-asc"
            showZodiacRing
            showHouseNumbers
            size={520}
          />
        )}

        <p className="mt-2 text-xs text-gray-500">
          Lo switch ricalcola ASC/MC e cuspidi e salva in <code>house_cusps</code>.
        </p>
      </div>

      <div className="rounded-2xl border p-4 min-h-[480px]">
        <h2 className="text-lg font-semibold mb-3">Ask about your chart</h2>
        <ChatUI />
      </div>
    </div>
  );
}
