// src/app/lab/people-pro/[id]/page.tsx
import { headers } from 'next/headers';
import SynastryWheelPro, {
  type PlanetOrAngle,
  type ChartPoint,
  type SAspect,
  type SAspectType,
} from '@/components/astro/SynastryWheelPro';
import { createSupabaseServerComponentClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type HouseRow = { longitude: number };
type CPRow = { name: string; longitude: number; retro: boolean | null; sign?: string | null; house?: number | null };

// Limiti nomi
const PLANETS: ReadonlySet<string> = new Set([
  'Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto',
  'ASC','MC',
]);
const isPlanetOrAngle = (x: string): x is PlanetOrAngle => PLANETS.has(x);

async function serverPostWithCookies(path: string, body: Record<string, unknown>) {
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const origin = `${proto}://${host}`;
  const res = await fetch(`${origin}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: h.get('cookie') ?? '',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  return res;
}

function to12(rows: HouseRow[] | null | undefined): number[] | undefined {
  const xs = (rows ?? []).map(r => Number(r.longitude)).filter(n => Number.isFinite(n));
  return xs.length === 12 ? xs : undefined;
}

async function fetchHousesForPerson(supabase: ReturnType<typeof createSupabaseServerComponentClient>, personId: string, system: 'placidus'|'whole') {
  const { data } = await supabase
    .from('people_house_cusps')
    .select('longitude')
    .eq('person_id', personId)
    .eq('system', system)
    .order('cusp', { ascending: true }) as unknown as { data: HouseRow[] | null };
  return to12(data);
}

async function fetchHousesForUser(supabase: ReturnType<typeof createSupabaseServerComponentClient>, userId: string, system: 'placidus'|'whole') {
  const { data } = await supabase
    .from('house_cusps')
    .select('longitude')
    .eq('user_id', userId)
    .eq('system', system)
    .order('cusp', { ascending: true }) as unknown as { data: HouseRow[] | null };
  return to12(data);
}

export default async function Page({
  params,
  searchParams,
}: {
  params: { id: string },
  searchParams?: { system?: string }
}) {
  const personId = params.id;
  const chosenSystem: 'placidus'|'whole' = searchParams?.system === 'whole' ? 'whole' : 'placidus';

  const supabase = createSupabaseServerComponentClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;

  // ----- USER houses: preleva entrambe -----
  const [uPlac, uWhole] = await Promise.all([
    userId ? fetchHousesForUser(supabase, userId, 'placidus') : Promise.resolve(undefined),
    userId ? fetchHousesForUser(supabase, userId, 'whole')    : Promise.resolve(undefined),
  ]);

  // ----- PERSON houses: preleva entrambe; se mancano prova a calcolare -----
  let pPlac = await fetchHousesForPerson(supabase, personId, 'placidus');
  let pWhole = await fetchHousesForPerson(supabase, personId, 'whole');

  if (!pPlac) {
    const res = await serverPostWithCookies('/api/people/house-cusps/upsert?system=placidus', { person_id: personId });
    if (res.ok) pPlac = await fetchHousesForPerson(supabase, personId, 'placidus');
  }
  if (!pWhole) {
    const res = await serverPostWithCookies('/api/people/house-cusps/upsert?system=whole', { person_id: personId });
    if (res.ok) pWhole = await fetchHousesForPerson(supabase, personId, 'whole');
  }

  // ----- Points -----
  const { data: userPtsRaw } = await supabase
    .from('chart_points')
    .select('name,longitude,retro,sign,house')
    .eq('user_id', userId) as unknown as { data: CPRow[] | null };

  const { data: personPtsRaw } = await supabase
    .from('people_chart_points')
    .select('name,longitude,retro')
    .eq('person_id', personId) as unknown as { data: CPRow[] | null };

  const userPts: ChartPoint[] = (userPtsRaw ?? [])
    .filter(p => isPlanetOrAngle(p.name))
    .map(p => ({
      name: p.name as PlanetOrAngle,
      lon: Number(p.longitude),
      retro: !!p.retro,
      sign: p.sign ?? null,
      house: p.house ?? null,
    }));

  const personPts: ChartPoint[] = (personPtsRaw ?? [])
    .filter(p => isPlanetOrAngle(p.name))
    .map(p => ({
      name: p.name as PlanetOrAngle,
      lon: Number(p.longitude),
      retro: !!p.retro,
    }));

  // ----- Aspects (assicurati che siano aggiornati e poi leggi) -----
  await serverPostWithCookies('/api/synastry/compute?persist=1', { person_id: personId });

  const { data: aspectsRaw } = await supabase
    .from('synastry_aspects')
    .select('a_owner,a_name,b_owner,b_name,aspect,exact,applying,score')
    .eq('person_id', personId) as unknown as {
      data: {
        a_owner: 'user'|'person';
        a_name: string;
        b_owner: 'user'|'person';
        b_name: string;
        aspect: SAspectType;
        exact: boolean | null;
        applying: boolean | null;
        score: number | null;
      }[] | null
    };

  const aspects: SAspect[] = (aspectsRaw ?? [])
    .filter(r => isPlanetOrAngle(r.a_name) && isPlanetOrAngle(r.b_name))
    .map(r => ({
      a: { owner: r.a_owner, name: r.a_name as PlanetOrAngle },
      b: { owner: r.b_owner, name: r.b_name as PlanetOrAngle },
      aspect: r.aspect,
      exact: !!r.exact,
      applying: !!r.applying,
      score: r.score ?? undefined,
    }));

  // ----- Scegli le case da mostrare in base al "system" -----
  const housesUser   = chosenSystem === 'placidus' ? (uPlac ?? undefined) : (uWhole ?? undefined);
  const housesPerson = chosenSystem === 'placidus' ? (pPlac ?? undefined) : (pWhole ?? undefined);

  // Assi derivati (I e X)
  const axesUser   = housesUser   ? { asc: housesUser[0]!,   mc: housesUser[9]! }   : undefined;
  const axesPerson = housesPerson ? { asc: housesPerson[0]!, mc: housesPerson[9]! } : undefined;

  // ----- UI -----
  return (
    <div className="px-4 py-6">
      <div className="mb-3 flex items-center gap-3">
        <form method="get" className="flex items-center gap-2">
          <label htmlFor="system" className="text-sm text-gray-700">Sistema case:</label>
          <select id="system" name="system" defaultValue={chosenSystem} className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm">
            <option value="placidus">Placidus</option>
            <option value="whole">Whole Sign</option>
          </select>
          <button type="submit" className="rounded-md bg-gray-900 px-3 py-1 text-sm text-white">Aggiorna</button>
        </form>
        <div className="text-xs text-gray-500">
          Mostrando: <b>{chosenSystem === 'placidus' ? 'Placidus' : 'Whole Sign'}</b>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="mx-auto w-full max-w-[860px]">
          <SynastryWheelPro
            user={{ points: userPts, houses: housesUser, axes: axesUser }}
            person={{ points: personPts, houses: housesPerson, axes: axesPerson }}
            aspects={aspects}
            responsive
          />
        </div>
      </div>
    </div>
  );
}
