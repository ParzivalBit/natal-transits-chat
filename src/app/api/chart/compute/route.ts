// src/app/api/chart/compute/route.ts
import { NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import { createSupabaseServerRouteClient } from '@/lib/supabaseServer';
import { computeHouses } from '@/lib/astro';
import { assignHouses } from '@/lib/houses/placidus';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type HouseSystem = 'placidus' | 'whole';

export async function POST(req: Request) {
  const supabase = createSupabaseServerRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  // 1) Override via query param (?system=placidus|whole)
  const url = new URL(req.url);
  const qSystem = url.searchParams.get('system');
  const overrideSystem: HouseSystem | null =
    qSystem === 'placidus' || qSystem === 'whole' ? qSystem : null;

  // 2) Preferenza attuale
  const { data: prefs } = await supabase
    .from('user_prefs')
    .select('house_system')
    .eq('user_id', user.id)
    .maybeSingle();

  let system: HouseSystem = prefs?.house_system === 'placidus' ? 'placidus' : 'whole';

  // 3) Se presente override, aggiorna preferenza PRIMA del calcolo
  if (overrideSystem && overrideSystem !== system) {
    const { error: upErr } = await supabase
      .from('user_prefs')
      .upsert({ user_id: user.id, house_system: overrideSystem }, { onConflict: 'user_id' });
    if (upErr) {
      return NextResponse.json({ ok: false, error: `prefs upsert: ${upErr.message}` }, { status: 500 });
    }
    system = overrideSystem;
  }

  // 4) Dati di nascita (schema reale)
  const { data: bd, error: bdErr } = await supabase
    .from('birth_data')
    .select('date,time,tz_offset_minutes,lat,lon')
    .eq('user_id', user.id)
    .maybeSingle();

  if (bdErr) {
    return NextResponse.json({ ok: false, error: `birth_data read: ${bdErr.message}` }, { status: 500 });
  }
  if (!bd?.date || bd.lat == null || bd.lon == null) {
    return NextResponse.json({ ok: false, error: 'Missing birth_data (date/lat/lon)' }, { status: 400 });
  }
  if (!bd.time) {
    // senza orario di nascita non si possono calcolare le case
    return NextResponse.json({ ok: false, error: 'Birth time required to compute houses' }, { status: 400 });
  }

  // 5) Calcolo JD (UT) da date+time locali e tz_offset_minutes
  //    Esempio: Europe/Rome in DST -> tz_offset_minutes = +120.
  //    UTC = local - offset.
  const tzOff = Number(bd.tz_offset_minutes ?? 0); // minuti est di UTC => sottrarre per andare a UTC
  const timeStr: string = String(bd.time).slice(0, 5); // "HH:MM"
  const dtUTC = DateTime.fromISO(`${bd.date}T${timeStr}`, { zone: 'UTC' }).minus({ minutes: tzOff });
  const jd = 2440587.5 + dtUTC.toMillis() / 86400000;

  // 6) Calcolo cuspidi (computeHouses gestisce eventuale fallback)
  const houses = computeHouses(system, {
    jd,
    latDeg: Number(bd.lat),
    lonDeg: Number(bd.lon),
    tzMinutes: tzOff,
  });

  // 7) Persistenza house_cusps (12 righe per system)
  const del = await supabase
    .from('house_cusps')
    .delete()
    .eq('user_id', user.id)
    .eq('system', system);
  if (del.error) {
    return NextResponse.json({ ok: false, error: `house_cusps delete: ${del.error.message}` }, { status: 500 });
  }

  const rows = houses.cusps.map((lon, i) => ({
    user_id: user.id,
    system,
    cusp: i + 1,
    longitude: lon,
  }));
  const ins = await supabase.from('house_cusps').insert(rows);
  if (ins.error) {
    return NextResponse.json({ ok: false, error: `house_cusps insert: ${ins.error.message}` }, { status: 500 });
  }

  // 8) Aggiorna chart_points.house in base alle nuove cuspidi
  const { data: points, error: ptErr } = await supabase
    .from('chart_points')
    .select('id, longitude')
    .eq('user_id', user.id);
  if (ptErr) {
    return NextResponse.json({ ok: false, error: `chart_points read: ${ptErr.message}` }, { status: 500 });
  }
  if (Array.isArray(points)) {
    for (const p of points) {
      const house = assignHouses(Number(p.longitude), houses.cusps);
      const up = await supabase.from('chart_points').update({ house }).eq('id', p.id);
      if (up.error) {
        return NextResponse.json({ ok: false, error: `chart_points update: ${up.error.message}` }, { status: 500 });
      }
    }
  }

  const fallbackApplied =
    (houses as { fallbackApplied?: boolean }).fallbackApplied ?? false;

  return NextResponse.json({
    ok: true,
    systemUsed: system,
    asc: houses.asc,
    mc: houses.mc,
    fallbackApplied,
  });
}
