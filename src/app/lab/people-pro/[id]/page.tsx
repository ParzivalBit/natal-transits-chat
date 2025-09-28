// src/app/lab/people-pro/[id]/page.tsx
import { headers } from 'next/headers';
import SynastryWheelPro from '@/components/astro/SynastryWheelPro';
import { createSupabaseServerComponentClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type HouseRow = { longitude: number };
type CPUser = { name: string; longitude: number; sign: string | null; house: number | null; retro: boolean | null };
type CPPerson = { name: string; longitude: number; retro: boolean | null };

type PlanetName =
  | 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars'
  | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune' | 'Pluto';
type AngleName = 'ASC' | 'MC';
type AllowedName = PlanetName | AngleName;

function to12(nums: Array<HouseRow> | null | undefined): number[] | null {
  const xs = (nums ?? []).map(r => Number(r.longitude));
  return xs.length === 12 && xs.every(Number.isFinite) ? xs : null;
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

export default async function Page({ params }: { params: { id: string } }) {
  const personId = params.id;
  const supabase = createSupabaseServerComponentClient();

  // USER
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;

  // Cuspidi utente: preferisci placidus, altrimenti whole come fallback
  const { data: uPlac } = await supabase
    .from('house_cusps')
    .select('longitude')
    .eq('user_id', userId)
    .eq('system', 'placidus')
    .order('cusp', { ascending: true }) as unknown as { data: HouseRow[] | null };
  let housesUser = to12(uPlac);

  if (!housesUser) {
    const { data: uWhole } = await supabase
      .from('house_cusps')
      .select('longitude')
      .eq('user_id', userId)
      .eq('system', 'whole')
      .order('cusp', { ascending: true }) as unknown as { data: HouseRow[] | null };
    housesUser = to12(uWhole);
  }

  // Punti utente
  const { data: userPts } = await supabase
    .from('chart_points')
    .select('name,longitude,sign,house,retro')
    .eq('user_id', userId) as unknown as { data: CPUser[] | null };

  // Persona: prova placidus, se assente fallback a whole
  const fetchPersonCusps = async (system: 'placidus' | 'whole') => {
    const { data } = await supabase
      .from('people_house_cusps')
      .select('longitude')
      .eq('person_id', personId)
      .eq('system', system)
      .order('cusp', { ascending: true }) as unknown as { data: HouseRow[] | null };
    return to12(data);
  };

  let housesPerson = await fetchPersonCusps('placidus');

  if (!housesPerson) {
    // Prova a calcolare forzando Placidus
    const res = await serverPostWithCookies('/api/people/house-cusps/upsert?system=placidus', {
      person_id: personId,
    });
    if (res.ok) {
      const json = (await res.json().catch(() => null)) as { system?: 'placidus' | 'whole' } | null;
      const sys = json?.system ?? 'placidus';
      housesPerson = await fetchPersonCusps(sys);
    }
  }

  // Se ancora nulla, prova WHOLE esplicito e usa quello
  if (!housesPerson) {
    const res2 = await serverPostWithCookies('/api/people/house-cusps/upsert?system=whole', { person_id: personId });
    if (res2.ok) housesPerson = await fetchPersonCusps('whole');
  }

  await serverPostWithCookies('/api/people/house-cusps/upsert?system=placidus', { person_id: personId });
  await serverPostWithCookies('/api/people/points/upsert', { person_id: personId });
  
  // Punti persona
  const { data: personPts } = await supabase
    .from('people_chart_points')
    .select('name,longitude,retro')
    .eq('person_id', personId) as unknown as { data: CPPerson[] | null };

  // Aspetti (persist)
  await serverPostWithCookies('/api/synastry/compute?persist=1', { person_id: personId });

  // Assi derivati dalle cuspidi (I/X) per coerenza visiva
  const axesUser = housesUser ? { asc: housesUser[0], mc: housesUser[9] } : undefined;
  const axesPerson = housesPerson ? { asc: housesPerson[0], mc: housesPerson[9] } : undefined;

  return (
    <div className="p-4">
      <SynastryWheelPro
        user={{
          points: (userPts ?? []).map(p => ({
            name: p.name as AllowedName,
            lon: p.longitude,
            sign: p.sign ?? null,
            house: p.house ?? null,
            retro: !!p.retro,
          })),
          houses: housesUser ?? undefined,
          axes: axesUser,
        }}
        person={{
          points: (personPts ?? []).map(p => ({
            name: p.name as AllowedName,
            lon: p.longitude,
            retro: !!p.retro,
          })),
          houses: housesPerson ?? undefined,
          axes: axesPerson,
        }}
        aspects={[]}
      />
    </div>
  );
}
