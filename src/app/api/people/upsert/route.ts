// src/app/api/people/house-cusps/upsert/route.ts
import { NextResponse } from 'next/server';
import { createSupabaseServerRouteClient } from '@/lib/supabaseServer';
import { computePersonHousesForUserSystem } from '@/lib/houses/runtime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export type HouseSystem = 'placidus' | 'whole';

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

const norm360 = (d: number) => ((Number(d) % 360) + 360) % 360;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const ok12 = (a: unknown): a is number[] => Array.isArray(a) && a.length === 12 && a.every(isNum);

const wholeFromSignStart = (deg0: number): number[] => {
  const base = Math.floor(norm360(deg0) / 30) * 30;
  return Array.from({ length: 12 }, (_, i) => norm360(base + i * 30));
};

function approxSunLongitudeUTC(dateUTC: Date): number {
  const JD = dateUTC.getTime() / 86400000 + 2440587.5;
  const n = JD - 2451545.0;
  const L = norm360(280.46 + 0.9856474 * n);
  const g = norm360(357.528 + 0.9856003 * n);
  const gRad = (g * Math.PI) / 180;
  const lambda = L + 1.915 * Math.sin(gRad) + 0.020 * Math.sin(2 * gRad);
  return norm360(lambda);
}

function makeUTC(birth_date: string, birth_time: string | null, tz_offset_minutes: number): Date {
  const [Y, M, D] = birth_date.split('-').map(Number);
  const [h, m] =
    birth_time && /^\d{2}:\d{2}$/.test(birth_time) ? birth_time.split(':').map(Number) : [12, 0];
  const local = new Date(Date.UTC(Y, (M ?? 1) - 1, D ?? 1, h ?? 12, m ?? 0, 0));
  return new Date(local.getTime() - (tz_offset_minutes ?? 0) * 60_000);
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerRouteClient();

  let stage = 'init';
  const diag: Array<{ stage: string; msg: string }> = [];

  try {
    const url = new URL(req.url);
    const isDebug = url.searchParams.get('debug') === '1';
    const allowSolar = url.searchParams.get('solar') === '1';

    // preferenza: default Placidus se non specificato
    const qsSystem = url.searchParams.get('system');
    const requestedSystem: HouseSystem =
      qsSystem === 'whole' ? 'whole' : 'placidus';

    stage = 'auth';
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized', stage }, { status: 401 });

    stage = 'body';
    const body = (await req.json().catch(() => ({}))) as { person_id?: string; system?: HouseSystem };
    const person_id = typeof body.person_id === 'string' ? body.person_id : '';
    const systemBody = body.system === 'whole' ? 'whole' : body.system === 'placidus' ? 'placidus' : null;
    const system: HouseSystem = systemBody ?? requestedSystem;

    if (!person_id) return NextResponse.json({ error: 'Missing person_id', stage }, { status: 400 });

    stage = 'load-person';
    const { data: p, error: pErr } = await supabase
      .from('people')
      .select('user_id,birth_date,birth_time,birth_tz_offset_minutes,birth_lat,birth_lon')
      .eq('id', person_id)
      .maybeSingle();

    if (pErr) return NextResponse.json({ error: pErr.message, stage }, { status: 500 });
    if (!p || p.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found', stage }, { status: 404 });
    }
    if (!p.birth_date || p.birth_lat == null || p.birth_lon == null) {
      return NextResponse.json({ error: 'person missing birth data', stage }, { status: 400 });
    }

    const birth_time: string | null =
      p.birth_time && p.birth_time.trim() !== '' ? p.birth_time : null;

    const baseInput: Omit<ComputeInput, 'userHouseSystem'> = {
      person: {
        birth_date: String(p.birth_date),
        birth_time,
        tz_offset_minutes: Number(p.birth_tz_offset_minutes ?? 0),
        lat: Number(p.birth_lat),
        lon: Number(p.birth_lon),
      },
      allowSolarFallback: allowSolar,
      sunLongitudeDeg: null,
    };

    stage = 'runtime-check';
    if (typeof computePersonHousesForUserSystem !== 'function') {
      return NextResponse.json({ error: 'runtime not available', stage }, { status: 500 });
    }

    const tryRuntime = async (sys: HouseSystem, tag: string): Promise<ComputeOutput | null> => {
      try {
        const r = await (computePersonHousesForUserSystem as unknown as
          (i: ComputeInput) => Promise<ComputeOutput>)({
          ...baseInput, userHouseSystem: sys,
        });
        if (ok12(r?.cusps)) return r;
        diag.push({ stage: `${tag}-invalid`, msg: 'non-12/finite' });
        return null;
      } catch (e) {
        diag.push({ stage: `${tag}-throw`, msg: (e as Error)?.message ?? 'unknown' });
        return null;
      }
    };

    // A) PRIORITÀ: PLACIDUS
    stage = 'runtime-placidus';
    let result: ComputeOutput | null = await tryRuntime(system, 'placidus-or-requested');

    // B) WHOLE runtime fallback (se Placidus richiesto e fallito)
    if (!result && system === 'placidus') {
      stage = 'runtime-whole';
      result = await tryRuntime('whole', 'whole');
      if (result) result.approx = result.approx ?? 'no-time';
    }

    // C1) WHOLE da ASC dal DB
    if (!result) {
      stage = 'manual-asc';
      const { data: asc } = await supabase
        .from('people_chart_points')
        .select('longitude')
        .eq('person_id', person_id)
        .in('name', ['ASC', 'Ac', 'Asc', 'AC', 'Ascendant'])
        .maybeSingle();

      if (asc?.longitude != null && isNum(Number(asc.longitude))) {
        const cusps = wholeFromSignStart(Number(asc.longitude));
        result = { cusps, system: 'whole', approx: 'no-time' };
      }
    }

    // C2) WHOLE da Sole (DB → se manca, stima al volo)
    if (!result && allowSolar) {
      stage = 'manual-solar';
      let sun: number | null = null;

      const { data: s1 } = await supabase
        .from('people_chart_points')
        .select('longitude')
        .eq('person_id', person_id)
        .in('name', ['Sun', 'Sole', '☉', 'SUN', 'sun'])
        .maybeSingle();

      if (s1?.longitude != null && isNum(Number(s1.longitude))) {
        sun = Number(s1.longitude);
      } else {
        const { data: s2 } = await supabase
          .from('people_chart_points')
          .select('longitude')
          .eq('person_id', person_id)
          .ilike('name', 'sun%')
          .maybeSingle();
        if (s2?.longitude != null && isNum(Number(s2.longitude))) {
          sun = Number(s2.longitude);
        }
      }

      if (sun == null) {
        const dtUTC = makeUTC(baseInput.person.birth_date, baseInput.person.birth_time, baseInput.person.tz_offset_minutes);
        sun = approxSunLongitudeUTC(dtUTC);
      }

      if (sun != null) {
        const cusps = wholeFromSignStart(sun);
        result = { cusps, system: 'whole', approx: 'solar' };
      }
    }

    if (!result || !ok12(result.cusps)) {
      const payload: Record<string, unknown> = { error: 'invalid cusps result (need 12 finite numbers)', stage: 'invalid-cusps' };
      if (isDebug) payload.diag = diag;
      return NextResponse.json(payload, { status: 422 });
    }

    stage = 'upsert';
    const rows = result.cusps.map((deg, i) => ({
      person_id,
      system: result.system,
      cusp: i + 1,
      longitude: norm360(deg),
    }));

    const { error: upErr } = await supabase
      .from('people_house_cusps')
      .upsert(rows, { onConflict: 'person_id,system,cusp' });

    if (upErr) return NextResponse.json({ error: upErr.message, stage: 'upsert-error' }, { status: 500 });

    const okPayload: Record<string, unknown> = {
      ok: true,
      count: rows.length,
      system: result.system,
      approx: result.approx ?? null,
      stage: 'done',
    };
    if (isDebug) okPayload.diag = diag;
    return NextResponse.json(okPayload, { status: 200 });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err?.message ?? 'unknown', stage }, { status: 500 });
  }
}
