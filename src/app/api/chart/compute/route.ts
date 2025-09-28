import { NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import { createSupabaseServerRouteClient } from '@/lib/supabaseServer';
import { computePoints, computeNatalAspects, type Point } from '@/lib/astro';
import { computePersonHousesForUserSystem } from '@/lib/houses/runtime';
import { resolveTimezoneForLocalMoment } from '@/lib/time/resolveTz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type BodyIn = {
  name?: string | null;
  date?: string | null;       // YYYY-MM-DD
  time?: string | null;       // HH:MM | HH:MM:SS | H:MM | HHMM
  place_name?: string | null;
  lat?: number | string | null;
  lon?: number | string | null;
  tz_name?: string | null;    // opzionale
};

type HouseSystem = 'placidus' | 'whole';

type ComputeInput = {
  person: {
    birth_date: string;
    birth_time: string | null;
    tz_offset_minutes: number;
    lat: number;
    lon: number;
  };
  userHouseSystem: HouseSystem;
  allowSolarFallback?: boolean;
  sunLongitudeDeg?: number | null;
};
type ComputeOutput = {
  cusps: number[];
  system: HouseSystem;
  approx?: 'no-time' | 'solar' | string | null;
};

function bad(msg: string, code = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: msg, ...(extra ?? {}) }, { status: code });
}

const norm360 = (d: number) => ((Number(d) % 360) + 360) % 360;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const ok12 = (a: unknown): a is number[] => Array.isArray(a) && a.length === 12 && a.every(isNum);
function toNumber(x: unknown): number | null {
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  if (typeof x === 'string' && x.trim() !== '' && Number.isFinite(Number(x))) return Number(x);
  return null;
}
function normalizeTime(t: string | null | undefined): string | null {
  if (t == null) return null;
  const raw = String(t).trim();
  if (raw === '' || raw.toLowerCase() === 'null' || raw.toLowerCase() === 'undefined') return null;
  const m1 = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m1) {
    const hh = String(Math.min(23, Math.max(0, Number(m1[1])))).padStart(2, '0');
    const mm = String(Math.min(59, Math.max(0, Number(m1[2])))).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  const m2 = raw.match(/^(\d{2})(\d{2})$/);
  if (m2) {
    const hh = String(Math.min(23, Math.max(0, Number(m2[1])))).padStart(2, '0');
    const mm = String(Math.min(59, Math.max(0, Number(m2[2])))).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  return null;
}

const SIGN_NAMES = [
  'Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces',
] as const;
type SignName = typeof SIGN_NAMES[number];
function signFromLon(lon: number): SignName {
  const idx = Math.floor(norm360(lon) / 30) % 12;
  return SIGN_NAMES[idx];
}
const VALID_POINT_NAMES = new Set<string>([
  'Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','ASC','MC',
]);
function pointKind(p: Pick<Point, 'name'>): 'planet' | 'angle' {
  return p.name === 'ASC' || p.name === 'MC' ? 'angle' : 'planet';
}
function houseIndexFromCusps(lon: number, cusps: number[]): number {
  const L = norm360(lon);
  for (let i = 0; i < 12; i++) {
    const a = norm360(cusps[i]);
    const b = norm360(cusps[(i + 1) % 12]);
    if (a === b) continue;
    if (a < b) { if (L >= a && L < b) return i + 1; }
    else { if (L >= a || L < b) return i + 1; }
  }
  return 1;
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerRouteClient();

  let stage = 'init';
  const diag: Array<{ stage: string; msg: string }> = [];

  try {
    stage = 'auth';
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return bad('Not authenticated', 401, { stage });
    const user_id = user.id;

    stage = 'query';
    const url = new URL(req.url);
    const qsSystem = url.searchParams.get('system');
    const debug = url.searchParams.get('debug') === '1';
    const requestedSystem: HouseSystem | null =
      qsSystem === 'placidus' ? 'placidus' : qsSystem === 'whole' ? 'whole' : null;

    stage = 'body';
    const b = (await req.json().catch(() => ({}))) as BodyIn;

    stage = 'load-birth';
    const { data: birth } = await supabase
      .from('birth_data')
      .select('name,date,time,tz_offset_minutes,place_name,lat,lon')
      .eq('user_id', user_id)
      .maybeSingle();

    stage = 'load-prefs';
    const { data: prefs } = await supabase
      .from('user_prefs')
      .select('house_system')
      .eq('user_id', user_id)
      .maybeSingle();

    const name = (b.name ?? birth?.name ?? 'Me').toString().trim();
    const date = (b.date ?? birth?.date ?? '').toString().trim();
    const timeNorm = normalizeTime(b.time ?? (birth?.time ?? null));
    const place_name = (b.place_name ?? birth?.place_name ?? '').toString().trim();
    const latNum = toNumber(b.lat ?? birth?.lat ?? null);
    const lonNum = toNumber(b.lon ?? birth?.lon ?? null);
    let tz_name: string | null = (b.tz_name || null) as string | null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad('Invalid date (YYYY-MM-DD required)', 400, { stage });
    if (b.time != null && timeNorm == null) return bad('Invalid time (expected HH:MM, HH:MM:SS, or HHMM)', 400, { stage: 'validate-time' });
    if (!place_name) return bad('Missing place_name', 400, { stage });
    if (latNum === null || lonNum === null) return bad('Missing coordinates', 400, { stage });

    const sysPref: HouseSystem = (prefs?.house_system === 'whole' ? 'whole' : 'placidus');
    const system: HouseSystem = requestedSystem ?? sysPref;

    // === Risoluzione TZ & costruzione UTC pivot ===
    stage = 'tz-resolve';
    const timeSafe: string = timeNorm ?? '12:00';

    let tz_off: number;
    try {
      const { tz_name: tzResolved, offset_minutes } = resolveTimezoneForLocalMoment(
        Number(latNum), Number(lonNum), date, timeSafe
      );
      tz_name = tz_name ?? tzResolved;
      tz_off = offset_minutes;
      diag.push({ stage: 'tz', msg: `resolved ${tz_name} / ${tz_off}min` });
    } catch {
      tz_off = Number(birth?.tz_offset_minutes ?? 0);
      diag.push({ stage: 'tz', msg: 'fallback to stored offset' });
    }

    // UTC pivot
    const dtLocal = tz_name
      ? DateTime.fromISO(`${date}T${timeSafe}`, { zone: tz_name })
      : DateTime.fromISO(`${date}T${timeSafe}`, { zone: 'UTC' }).minus({ minutes: tz_off });
    const dtUTC = dtLocal.toUTC();
    const utcDate = dtUTC.toISODate() as string;     // YYYY-MM-DD
    const utcHHMM = dtUTC.toFormat('HH:mm');         // HH:MM

    // === Punti (UTC pivot) ===
    stage = 'compute-points';
    const { points, timestampUTC }: { points: Point[]; timestampUTC: Date } =
      computePoints('UTC', utcDate, utcHHMM, Number(latNum), Number(lonNum));

    // === Cuspidi (priorità PLACIDUS) ===
    stage = 'compute-cusps';
    let cusps: number[] | null = null;
    let cuspsSystem: HouseSystem = system;

    const baseInput: ComputeInput = {
      person: {
        birth_date: date,
        birth_time: timeNorm,
        tz_offset_minutes: tz_off || 0,
        lat: Number(latNum) ?? 0,
        lon: Number(lonNum) ?? 0,
      },
      userHouseSystem: system,
      allowSolarFallback: true,
      sunLongitudeDeg: null,
    };

    const computeHouses = computePersonHousesForUserSystem as unknown as
      (i: ComputeInput) => Promise<ComputeOutput>;

    const tryRuntime = async (sys: HouseSystem, tag: string): Promise<void> => {
      try {
        const r = await computeHouses({ ...baseInput, userHouseSystem: sys });
        if (ok12(r?.cusps)) {
          cusps = r.cusps.map((x: number) => norm360(x));
          cuspsSystem = r.system;
          diag.push({ stage: `runtime-${tag}`, msg: 'ok' });
        } else {
          diag.push({ stage: `runtime-${tag}-invalid`, msg: 'non 12 finite numbers' });
        }
      } catch (e) {
        diag.push({ stage: `runtime-${tag}-throw`, msg: (e as Error)?.message ?? 'unknown' });
      }
    };

    if (system === 'placidus') {
      await tryRuntime('placidus', 'placidus');
      if (!cusps) await tryRuntime('whole', 'whole-fallback');
    } else {
      await tryRuntime('whole', 'whole');
      if (!cusps) await tryRuntime('placidus', 'placidus-fallback');
    }

    if (!cusps) {
      return bad('Could not compute house cusps (need 12 finite numbers)', 422, { stage: 'cusps-failed', diag: debug ? diag : undefined });
    }

    // === Persistenza
    stage = 'save-birth-data';
    {
      const { error } = await supabase
        .from('birth_data')
        .upsert(
          {
            user_id,
            name,
            date,
            time: timeSafe,
            tz_offset_minutes: tz_off,
            place_name,
            lat: Number(latNum),
            lon: Number(lonNum),
            created_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
      if (error) throw new Error(`birth_data upsert: ${error.message}`);
    }

    stage = 'save-house-cusps';
    {
      const cuspsList: number[] = cusps as number[];
      const rows = cuspsList.map((deg: number, i: number) => ({
        user_id,
        system: cuspsSystem,
        cusp: i + 1,
        longitude: norm360(deg),
      }));
      const { error } = await supabase
        .from('house_cusps')
        .upsert(rows, { onConflict: 'user_id,system,cusp' });
      if (error) throw new Error(`house_cusps upsert: ${error.message}`);
    }

    let seedWarn: string | null = null;
    stage = 'seed-chart-points';
    try {
      const del = await supabase.from('chart_points').delete().eq('user_id', user_id);
      if (del.error) throw new Error(`chart_points delete: ${del.error.message}`);

      const rows = points
        .filter((p) => p && VALID_POINT_NAMES.has(p.name) && isNum(p.longitude))
        .map((p) => ({
          user_id,
          kind: pointKind(p),
          name: p.name,
          longitude: norm360(p.longitude),
          sign: signFromLon(p.longitude),
          house: null as number | null,
          retro: !!p.retro,
        }));

      if (rows.length) {
        const ins = await supabase.from('chart_points').insert(rows);
        if (ins.error) throw new Error(`chart_points insert: ${ins.error.message}`);
      }
    } catch (e) {
      seedWarn = (e as Error)?.message ?? 'seed failed';
      diag.push({ stage: 'seed-chart-points-error', msg: seedWarn });
    }

    stage = 'assign-houses';
    try {
      const { data: pts } = await supabase
        .from('chart_points')
        .select('id,name,longitude')
        .eq('user_id', user_id);

      if (Array.isArray(pts) && pts.length) {
        const updates = pts.map((row: { id: string; name: string; longitude: number }) => {
          const isAngle = row.name === 'ASC' || row.name === 'MC';
          const h = houseIndexFromCusps(row.longitude, cusps as number[]);
          return { id: row.id, house: isAngle ? null : h };
        });

        const { error: upErr } = await supabase
          .from('chart_points')
          .upsert(updates, { onConflict: 'id' });
        if (upErr) throw new Error(`chart_points.house assign: ${upErr.message}`);
      }
    } catch (e) {
      const msg = (e as Error)?.message ?? 'assign failed';
      diag.push({ stage: 'assign-houses-error', msg });
    }

    stage = 'natal-aspects';
    try {
      const aspects = computeNatalAspects(points);
      const del = await supabase.from('natal_aspects').delete().eq('user_id', user_id);
      if (del.error) throw new Error(`natal_aspects delete: ${del.error.message}`);
      const rows = aspects.map((a) => ({
        user_id,
        p1: a.p1,
        p2: a.p2,
        aspect: a.aspect,
        orb: a.orb,
        strength: a.strength,
      }));
      if (rows.length) {
        const ins = await supabase.from('natal_aspects').insert(rows);
        if (ins.error) throw new Error(`natal_aspects insert: ${ins.error.message}`);
      }
    } catch (e) {
      diag.push({ stage: 'natal-aspects-error', msg: (e as Error)?.message ?? 'failed' });
    }

    const payload: Record<string, unknown> = {
      ok: true,
      stage: 'done',
      info: { system_used: cuspsSystem, timestampUTC },
      saved: { house_cusps: 12 },
    };
    if (seedWarn) payload['warn'] = seedWarn;
    if (debug) payload['diag'] = diag;
    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (process.env.NODE_ENV !== 'production') console.error('[chart/compute] ERROR:', err, { stage });
    return NextResponse.json({ ok: false, error: msg, stage }, { status: 500 });
  }
}
