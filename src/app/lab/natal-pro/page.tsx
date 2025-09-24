// src/app/lab/natal-pro/page.tsx
import nextDynamic from 'next/dynamic';
import { createSupabaseServerComponentClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import { computeHouses } from '@/lib/astro';

const ChartWheelPro = nextDynamic(() => import('@/components/astro/ChartWheelPro'), { ssr: false });

export const dynamic = 'force-dynamic';

type HouseSystem = 'placidus' | 'whole';
interface ChartPoint {
  name: string;
  longitude: number;
  sign: string;
  house: number | null;
  retro: boolean;
}

export default async function Page() {
  const supabase = createSupabaseServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/onboarding');

  const { data: prefs } = await supabase
    .from('user_prefs')
    .select('house_system')
    .eq('user_id', user.id)
    .maybeSingle();

  const system: HouseSystem = prefs?.house_system === 'placidus' ? 'placidus' : 'whole';

  const { data: cuspsRows } = await supabase
    .from('house_cusps')
    .select('cusp, longitude')
    .eq('user_id', user.id)
    .eq('system', system)
    .order('cusp');

  let cusps: number[] | null =
    Array.isArray(cuspsRows) && cuspsRows.length === 12 ? cuspsRows.map(r => Number(r.longitude)) : null;

  //let mc: number | undefined;

  if (!cusps) {
    const { data: bd } = await supabase
      .from('birth_data')
      .select('date,time,tz_offset_minutes,lat,lon')
      .eq('user_id', user.id)
      .maybeSingle();

    if (bd?.date && bd.time && bd.lat != null && bd.lon != null) {
      const [hh, mm] = String(bd.time).slice(0, 5).split(':').map(Number);
      const local = new Date(`${bd.date}T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00Z`);
      const tzOff = Number(bd.tz_offset_minutes ?? 0);
      const jdUT = local.getTime() / 86400000 + 2440587.5 - tzOff/1440;

      const pkt = computeHouses(system, {
        jd: jdUT,
        latDeg: Number(bd.lat),
        lonDeg: Number(bd.lon),
        tzMinutes: tzOff,
      });

      cusps = pkt.cusps;
      //mc = pkt.mc;
    }
  }

  const { data: pointsRaw } = await supabase
    .from('chart_points')
    .select('name,longitude,sign,house,retro')
    .eq('user_id', user.id)
    .order('name');

  const points: ChartPoint[] = Array.isArray(pointsRaw)
    ? pointsRaw.map((p: unknown) => {
        const obj = p as { name: string; longitude: number; sign: string | null; house: number | null; retro: boolean | null };
        return {
          name: String(obj.name),
          longitude: Number(obj.longitude),
          sign: String(obj.sign ?? ''),
          house: obj.house ?? null,
          retro: Boolean(obj.retro),
        };
      })
    : [];

  return (
    <div className="p-6 space-y-3">
      <h1 className="text-xl font-semibold">Lab · Natal Pro</h1>
      <ChartWheelPro
        title={`Natal (system: ${system})`}
        points={points}
        houseCusps={cusps ?? undefined}
      />
    </div>
  );
}
