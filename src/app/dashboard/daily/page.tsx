// src/app/dashboard/daily/page.tsx
import { createSupabaseServerComponentClient } from '@/lib/supabaseServer';
import dynamicImport from 'next/dynamic';
import { redirect } from 'next/navigation';
import { computeHousesForDateUTC } from '@/lib/houses/runtime';
import { computeDailyPlanets } from '@/lib/planets/runtime';
import { assignHouses } from '@/lib/houses/placidus';

export const dynamic = 'force-dynamic';

type HouseSystem = 'whole' | 'placidus';

type PrefsRow = {
  house_system: HouseSystem | null;
  current_lat: number | null;
  current_lon: number | null;
};

type ChartPoint = {
  name: string;
  longitude: number;
  sign: string;
  house: number | null;
  retro?: boolean | null;
};

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

export default async function DailyPage({
  searchParams,
}: {
  searchParams?: { houses?: string };
}) {
  const supabase = createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/onboarding');

  const { data: prefs, error: prefsErr } = await supabase
    .from('user_prefs')
    .select('house_system, current_lat, current_lon')
    .eq('user_id', user.id)
    .single<PrefsRow>();

  if (prefsErr || !prefs || prefs.current_lat == null || prefs.current_lon == null) {
    redirect('/onboarding');
  }

  const system: HouseSystem = prefs.house_system === 'placidus' ? 'placidus' : 'whole';
  const lat = Number(prefs.current_lat);
  const lon = Number(prefs.current_lon);

  const nowUTC = new Date();

  const houses = computeHousesForDateUTC({
    system,
    dateUTC: nowUTC,
    latDeg: lat,
    lonDeg: lon,
  });

  // Toggle case via querystring: ?houses=0 le nasconde
  const showHouses = (searchParams?.houses ?? '1') !== '0';

  // Pianeti del giorno (nascondiamo il marker retro per evitare il simbolo ℞/Px)
  const runtimePlanets = computeDailyPlanets(nowUTC);
  const points: ChartPoint[] = runtimePlanets.map((p) => ({
    name: p.name,
    longitude: p.longitude,
    sign: p.sign,
    house: assignHouses(p.longitude, houses.cusps),
    retro: false, // ← niente marker retro in /daily
  }));

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="rounded-2xl border p-4">
        <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Daily wheel</h2>
        <HouseSystemSwitcher current={system} />
        </div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">
            Daily Chart — {houses.system === 'placidus' ? 'Placidus' : 'Whole Sign'}
          </h2>
          <div className="flex items-center gap-3 text-xs">
            <a
              className="underline text-blue-600"
              href={showHouses ? '?houses=0' : '?houses=1'}
            >
              {showHouses ? 'Nascondi case' : 'Mostra case'}
            </a>
            <span className="text-gray-500">
              {new Intl.DateTimeFormat('it-IT', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(nowUTC)}{' '}
              UTC
            </span>
          </div>
        </div>

        {houses.fallbackApplied && (
          <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 text-amber-800 text-sm px-3 py-2">
            Placidus non è definito per latitudini estreme. Visualizzazione in Whole Sign.
          </div>
        )}

        <ChartWheel
          points={points}
          houseCusps={showHouses ? houses.cusps : undefined}
          mcDeg={houses.mc}
          orientation="by-asc"
          showZodiacRing
          showHouseNumbers={showHouses}
          size={520}
        />

        <div className="mt-3 text-xs text-gray-600 space-y-1">
          <div><span className="font-medium">ASC:</span> {houses.asc.toFixed(2)}°</div>
          <div><span className="font-medium">MC:</span> {houses.mc.toFixed(2)}°</div>
          <div className="text-gray-500">Calcolo <em>runtime</em>; nessuna persistenza su DB.</div>
        </div>
      </div>

      <div className="rounded-2xl border p-4 min-h-[480px]">
        <h2 className="text-lg font-semibold mb-3">Ask about today</h2>
        <ChatUI />
      </div>
    </div>
  );
}
