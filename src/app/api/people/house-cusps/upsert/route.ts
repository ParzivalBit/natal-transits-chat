import { NextResponse } from 'next/server';
import { createSupabaseServerRouteClient } from '@/lib/supabaseServer';
import { computePersonHousesForUserSystem } from '@/lib/houses/runtime';
import { resolveTimezoneForLocalMoment } from '@/lib/time/resolveTz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

const norm360 = (d: number) => ((Number(d) % 360) + 360) % 360;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const ok12 = (a: unknown): a is number[] => Array.isArray(a) && a.length === 12 && a.every(isNum);

const wholeFromSignStart = (deg0: number): number[] => {
  const base = Math.floor(norm360(deg0) / 30) * 30;
  return Array.from({ length: 12 }, (_, i) => norm360(base + i * 30));
};

function normalizeHHMM(t: string | null | undefined): string | null {
  if (!t) return null;
  const raw = String(t).trim();
  if (raw === '') return null;
  const m1 = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/); // HH:MM o HH:MM:SS
  if (!m1) return null;
  const hh = String(Math.min(23, Math.max(0, Number(m1[1])))).padStart(2, '0');
  const mm = String(Math.min(59, Math.max(0, Number(m1[2])))).padStart(2, '0');
  return `${hh}:${mm}`;
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerRouteClient();

  let stage = 'init';
  const diag: Array<{ stage: string; msg: string }> = [];

  try {
    const url = new URL(req.url);
    const isDebug = url.searchParams.get('debug') === '1';
    const qsSystem = url.searchParams.get('system');
    const requestedSystem: HouseSystem = qsSystem === 'whole' ? 'whole' : 'placidus';

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
    if (!p || p.user_id !== user.id) return NextResponse.json({ error: 'Not found', stage }, { status: 404 });
    if (!p.birth_date) return NextResponse.json({ error: 'person missing birth_date', stage }, { status: 400 });

    // Normalizza l'orario ai minuti (gestisce anche HH:MM:SS)
    const birth_time: string | null = normalizeHHMM(p.birth_time);
    const lat = Number(p.birth_lat ?? NaN);
    const lon = Number(p.birth_lon ?? NaN);

    // 1) Risolviamo offset storico in base a luogo+data+ora
    stage = 'resolve-tz';
    let tzOff: number = Number(p.birth_tz_offset_minutes ?? NaN);
    if (!Number.isFinite(tzOff) || tzOff === 0) {
      if (Number.isFinite(lat) && Number.isFinite(lon) && birth_time) {
        try {
          const { offset_minutes } = resolveTimezoneForLocalMoment(
            Number(lat), Number(lon), String(p.birth_date), birth_time
          );
          tzOff = offset_minutes;
          diag.push({ stage: 'tz', msg: `resolved offset ${tzOff}min` });
        } catch {
          tzOff = 0;
          diag.push({ stage: 'tz', msg: 'fallback offset 0' });
        }
      } else {
        tzOff = 0;
        diag.push({ stage: 'tz', msg: 'insufficient data for tz resolve' });
      }
    }

    // 2) Runtime houses: priorità PLACIDUS, ma solo fallback a WHOLE se serve davvero
    stage = 'runtime';
    const baseInput: ComputeInput = {
      person: {
        birth_date: String(p.birth_date),
        birth_time, // ora normalizzata, se presente
        tz_offset_minutes: tzOff || 0,
        lat: Number.isFinite(lat) ? Number(lat) : 0,
        lon: Number.isFinite(lon) ? Number(lon) : 0,
      },
      userHouseSystem: system,
      allowSolarFallback: true,
      sunLongitudeDeg: null,
    };

    const computeHouses = computePersonHousesForUserSystem as unknown as
      (i: ComputeInput) => Promise<ComputeOutput>;

    let result: ComputeOutput | null = null;

    const tryRuntime = async (sys: HouseSystem, tag: string): Promise<void> => {
      try {
        const r = await computeHouses({ ...baseInput, userHouseSystem: sys });
        if (ok12(r?.cusps)) {
          result = { cusps: r.cusps.map((x: number) => norm360(x)), system: r.system, approx: r.approx ?? null };
          diag.push({ stage: `rt-${tag}`, msg: 'ok' });
        } else {
          diag.push({ stage: `rt-${tag}-invalid`, msg: 'non 12 finite numbers' });
        }
      } catch (e) {
        diag.push({ stage: `rt-${tag}-throw}`, msg: (e as Error)?.message ?? 'unknown' });
      }
    };

    if (system === 'placidus') {
      await tryRuntime('placidus', 'placidus');
      if (!result) await tryRuntime('whole', 'whole-fallback');
    } else {
      await tryRuntime('whole', 'whole');
      if (!result) await tryRuntime('placidus', 'placidus-fallback');
    }

    // 3) Ultimo fallback: WHOLE manuale da ASC, solo se tutto il resto fallisce
    if (!result) {
      stage = 'manual-asc';
      const { data: asc } = await supabase
        .from('people_chart_points')
        .select('longitude')
        .eq('person_id', person_id)
        .in('name', ['ASC', 'Ac', 'Asc', 'AC', 'Ascendant'])
        .maybeSingle();

      if (asc?.longitude != null && isNum(Number(asc.longitude))) {
        result = { cusps: wholeFromSignStart(Number(asc.longitude)), system: 'whole', approx: 'no-time' };
        diag.push({ stage: 'manual-asc', msg: 'ok' });
      } else {
        diag.push({ stage: 'manual-asc', msg: 'ASC not found' });
      }
    }

    if (!result || !ok12(result.cusps)) {
      const payload: Record<string, unknown> = {
        error: 'invalid cusps result (need 12 finite numbers)',
        stage: 'invalid-cusps',
      };
      if (isDebug) payload['diag'] = diag;
      return NextResponse.json(payload, { status: 422 });
    }

    // 4) Upsert
    const final: ComputeOutput = result;
    const rows = final.cusps.map((deg: number, i: number) => ({
      person_id,
      system: final.system,
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
      system: final.system,
      approx: final.approx ?? null,
      stage: 'done',
    };
    if (isDebug) okPayload['diag'] = diag;
    return NextResponse.json(okPayload, { status: 200 });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err?.message ?? 'unknown', stage }, { status: 500 });
  }
}
