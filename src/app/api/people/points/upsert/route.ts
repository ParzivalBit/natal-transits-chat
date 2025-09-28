// src/app/api/people/points/upsert/route.ts
import { NextResponse } from 'next/server';
import { createSupabaseServerRouteClient } from '@/lib/supabaseServer';
import { computePoints, type Point } from '@/lib/astro';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type OkJson = {
  ok: true;
  person_id: string;
  points_saved: number;
  assigned_house: boolean;
  used_system: 'placidus' | 'whole' | 'none';
};

type ErrJson = {
  ok: false;
  stage: string;
  error: string;
};

type HouseSystem = 'placidus' | 'whole';

/** normalize to [0, 360) */
const norm360 = (d: number): number => ((d % 360) + 360) % 360;

/** zodiac sign name from longitude 0..360 */
function signFromLon(lon: number): string {
  const signs = [
    'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
  ];
  const idx = Math.floor(norm360(lon) / 30) % 12;
  return signs[idx];
}

/** pad 2 digits */
const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Build UTC ISO date/time strings from (local date, time, offset minutes) */
function toUtcDateTimeParts(birth_date: string, birth_time: string | null, tz_offset_minutes: number): { dateUTC: string; timeHHMMUTC: string } {
  // default a mezzogiorno locale se orario mancante
  const [Y, M, D] = birth_date.split('-').map((x) => Number(x));
  let hh = 12; let mm = 0;
  if (birth_time && /^\d{1,2}:\d{2}$/.test(birth_time)) {
    const [h, m] = birth_time.split(':').map((x) => Number(x));
    hh = Math.min(23, Math.max(0, h));
    mm = Math.min(59, Math.max(0, m));
  }
  // costruisci Date in locale poi sottrai offset per arrivare a UTC
  const local = new Date(Date.UTC(Y, (M || 1) - 1, D || 1, hh, mm, 0));
  const utcMs = local.getTime() - (tz_offset_minutes || 0) * 60_000;
  const utc = new Date(utcMs);
  const y = utc.getUTCFullYear();
  const m = pad2(utc.getUTCMonth() + 1);
  const d = pad2(utc.getUTCDate());
  const h2 = pad2(utc.getUTCHours());
  const m2 = pad2(utc.getUTCMinutes());
  return { dateUTC: `${y}-${m}-${d}`, timeHHMMUTC: `${h2}:${m2}` };
}

/** Determine house index (1..12) for a longitude given 12 cusps (deg) sorted by house number */
function houseIndex(lonDeg: number, cusps: number[]): number {
  const lon = norm360(lonDeg);
  for (let i = 0; i < 12; i++) {
    const a = norm360(cusps[i]);
    const b = norm360(cusps[(i + 1) % 12]);
    const span = (b - a + 360) % 360;
    const rel = (lon - a + 360) % 360;
    if (rel >= 0 && rel < span) return i + 1; // 1..12
  }
  return 1;
}

/** Validate a numeric array of 12 finite values */
function isCusps(a: unknown): a is number[] {
  return Array.isArray(a) && a.length === 12 && a.every((v) => typeof v === 'number' && Number.isFinite(v));
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerRouteClient();

  let stage = 'init';
  try {
    // Auth
    stage = 'auth';
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id ?? null;
    if (!userId) {
      return NextResponse.json<ErrJson>({ ok: false, stage, error: 'Unauthorized' }, { status: 401 });
    }

    // Body
    stage = 'body';
    const body = (await req.json().catch(() => ({}))) as { person_id?: string; system?: HouseSystem };
    const person_id = typeof body.person_id === 'string' ? body.person_id : '';
    if (!person_id) {
      return NextResponse.json<ErrJson>({ ok: false, stage, error: 'Missing person_id' }, { status: 400 });
    }

    // Load person row
    stage = 'load-person';
    const { data: p, error: pErr } = await supabase
      .from('people')
      .select('user_id,birth_date,birth_time,birth_tz_offset_minutes,birth_lat,birth_lon')
      .eq('id', person_id)
      .maybeSingle();
    if (pErr) {
      return NextResponse.json<ErrJson>({ ok: false, stage, error: pErr.message }, { status: 500 });
    }
    if (!p || p.user_id !== userId) {
      return NextResponse.json<ErrJson>({ ok: false, stage, error: 'Not found' }, { status: 404 });
    }
    if (!p.birth_date) {
      return NextResponse.json<ErrJson>({ ok: false, stage, error: 'person missing birth_date' }, { status: 400 });
    }

    const birth_time: string | null =
      p.birth_time && p.birth_time.trim() !== '' ? p.birth_time : null;

    const lat = Number(p.birth_lat ?? NaN);
    const lon = Number(p.birth_lon ?? NaN);
    const tzOff = Number(p.birth_tz_offset_minutes ?? 0);

    const latOk = Number.isFinite(lat) ? lat : 0;
    const lonOk = Number.isFinite(lon) ? lon : 0;

    // Pivot in UTC (stessa strategia usata per l’utente)
    stage = 'utc';
    const { dateUTC, timeHHMMUTC } = toUtcDateTimeParts(String(p.birth_date), birth_time, tzOff);

    // Compute points (in UTC, tz='UTC')
    stage = 'compute';
    const result: { points: Point[] } = computePoints('UTC', dateUTC, timeHHMMUTC, latOk, lonOk);

    // Carica eventuali cuspidi persona (per assegnare la house)
    stage = 'load-cusps';
    const { data: cuspsRows } = await supabase
      .from('people_house_cusps')
      .select('cusp,longitude,system')
      .eq('person_id', person_id)
      .eq('system', body.system === 'whole' ? 'whole' : 'placidus')
      .order('cusp', { ascending: true });

    const cusps = cuspsRows?.map((r: { cusp: number; longitude: number }) => Number(r.longitude)) ?? [];
    const haveCusps = isCusps(cusps);
    const usedSystem: HouseSystem | 'none' = haveCusps ? (body.system === 'whole' ? 'whole' : 'placidus') : 'none';

    // Seed people_chart_points (wipe + insert coerente)
    stage = 'upsert-points';
    const del = await supabase.from('people_chart_points').delete().eq('person_id', person_id);
    if (del.error) {
      return NextResponse.json<ErrJson>({ ok: false, stage, error: del.error.message }, { status: 500 });
    }

    const rows = result.points
      .filter((pnt) => pnt.name !== 'ASC' && pnt.name !== 'MC') // ASC/MC li disegniamo come assi
      .map((pnt) => {
        const lonDeg = norm360(pnt.longitude);
        const row = {
          person_id,
          name: pnt.name,
          longitude: lonDeg,
          sign: signFromLon(lonDeg),
          house: haveCusps ? houseIndex(lonDeg, cusps) : null as number | null,
          retro: Boolean(pnt.retro),
        };
        return row;
      });

    if (rows.length) {
      const ins = await supabase.from('people_chart_points').insert(rows);
      if (ins.error) {
        return NextResponse.json<ErrJson>({ ok: false, stage, error: ins.error.message }, { status: 500 });
      }
    }

    const ok: OkJson = {
      ok: true,
      person_id,
      points_saved: rows.length,
      assigned_house: haveCusps,
      used_system: usedSystem,
    };
    return NextResponse.json(ok, { status: 200 });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json<ErrJson>({ ok: false, stage, error: err.message || 'unknown' }, { status: 500 });
  }
}
