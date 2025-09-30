// src/app/lab/people-pro/[id]/page.tsx

import { headers } from 'next/headers';
import { createSupabaseServerComponentClient } from '@/lib/supabaseServer';
import SynastryPeopleProClient from './SynastryPeopleProClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type HouseRow = { longitude: number };
type CPRow = { name: string; longitude: number; retro: boolean | null; sign?: string | null; house?: number | null };

type PlanetNameStrict =
  | 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars'
  | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune' | 'Pluto';
type AngleName = 'ASC' | 'MC';
type PlanetOrAngle = PlanetNameStrict | AngleName;

type ChartPoint = {
  name: PlanetOrAngle;
  lon: number;           // 0..360
  retro?: boolean;
  sign?: string | null;
  house?: number | null;
};

type SAspectType = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';

type AspectRow = {
  p1_owner: 'user'|'person';
  p1_name: string;
  p2_owner: 'user'|'person';
  p2_name: string;
  aspect: SAspectType;
  angle: number | null;            // es. 0,60,90,120,180
  orb: number | null;              // distanza dall'angolo esatto (±gradi)
  applying: boolean | null;
  score: number | null;
};

const PLANETS: ReadonlySet<string> = new Set([
  'Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto',
  'ASC','MC',
]);
const isPlanetOrAngle = (x: string): x is PlanetOrAngle => PLANETS.has(x);

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

export default async function Page({
  params,
  searchParams,
}: {
  params: { id: string },
  searchParams?: { system?: string; cj?: string; sx?: string; sq?: string; tr?: string; op?: string; orb?: string }
}) {
  const personId = params.id;
  const chosenSystem: 'placidus'|'whole' = searchParams?.system === 'whole' ? 'whole' : 'placidus';

  // flags iniziali (da URL; default ON)
  const initialFlags = {
    conjunction: searchParams?.cj !== '0',
    sextile:     searchParams?.sx !== '0',
    square:      searchParams?.sq !== '0',
    trine:       searchParams?.tr !== '0',
    opposition:  searchParams?.op !== '0',
  };
  const rawOrbOffset = Number(searchParams?.orb ?? 0);
  const initialOrbOffset = Number.isFinite(rawOrbOffset) ? rawOrbOffset : 0;

  const supabase = createSupabaseServerComponentClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;

  // USER houses
  const [uPlac, uWhole] = await Promise.all([
    userId ? fetchHousesForUser(supabase, userId, 'placidus') : Promise.resolve(undefined),
    userId ? fetchHousesForUser(supabase, userId, 'whole')    : Promise.resolve(undefined),
  ]);

  // PERSON houses (compute se mancano)
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

  // Points
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

  // Assicura aspetti aggiornati (persistenza server, ma la UI filtrerà live)
  await serverPostWithCookies('/api/synastry/compute?persist=1', {
    person_id: personId,
    enabled: initialFlags,
    orbOffset: initialOrbOffset,
  });

  // Leggi aspetti “grezzi” (con orb numerico)
  const { data: aspectsRaw } = await supabase
    .from('synastry_aspects')
    .select('p1_owner,p1_name,p2_owner,p2_name,aspect,angle,orb,applying,score')
    .eq('user_id', userId)
    .eq('person_id', personId) as unknown as { data: AspectRow[] | null };

  // Case scelte
  const housesUser   = chosenSystem === 'placidus' ? (uPlac ?? undefined) : (uWhole ?? undefined);
  const housesPerson = chosenSystem === 'placidus' ? (pPlac ?? undefined) : (pWhole ?? undefined);

  const axesUser   = housesUser   ? { asc: housesUser[0]!,   mc: housesUser[9]! }   : undefined;
  const axesPerson = housesPerson ? { asc: housesPerson[0]!, mc: housesPerson[9]! } : undefined;

  return (
    <SynastryPeopleProClient
      personId={personId}
      chosenSystem={chosenSystem}
      user={{ points: userPts, houses: housesUser, axes: axesUser }}
      person={{ points: personPts, houses: housesPerson, axes: axesPerson }}
      aspectsRaw={aspectsRaw ?? []}
      initialFlags={initialFlags}
      initialOrbOffset={initialOrbOffset}
    />
  );
}
