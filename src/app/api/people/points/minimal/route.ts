// src/app/api/people/points/minimal/route.ts
import { NextResponse } from 'next/server';
import { createSupabaseServerRouteClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic'; // niente cache su Vercel/Next

const norm360 = (d: number) => ((Number(d) % 360) + 360) % 360;

type MinimalReq = { person_id?: string };
type MinimalResp =
  | { ok: true; upserted: number; approxSun: boolean }
  | { error: string; stage?: string };

// Stima longitudine eclittica del Sole (deg) — formula semplice (errore ~1°–2°)
function approxSunLongitudeUTC(dateUTC: Date): number {
  const JD = dateUTC.getTime() / 86400000 + 2440587.5; // Unix ms -> JD
  const n = JD - 2451545.0;
  const L = norm360(280.46 + 0.9856474 * n);
  const g = norm360(357.528 + 0.9856003 * n);
  const gRad = (g * Math.PI) / 180;
  const lambda = L + 1.915 * Math.sin(gRad) + 0.020 * Math.sin(2 * gRad);
  return norm360(lambda);
}

// Costruisce una data UTC da (data, orario locale HH:MM opz, offset minuti)
function makeUTC(birth_date: string, birth_time: string | null, tz_offset_minutes: number): Date {
  const [Y, M, D] = birth_date.split('-').map(Number);
  const [h, m] =
    birth_time && /^\d{2}:\d{2}$/.test(birth_time) ? birth_time.split(':').map(Number) : [12, 0];
  const local = new Date(Date.UTC(Y, (M ?? 1) - 1, D ?? 1, h ?? 12, m ?? 0, 0));
  return new Date(local.getTime() - (tz_offset_minutes ?? 0) * 60_000);
}

// GET di servizio per verificare che la route sia “viva”
export async function GET() {
  return NextResponse.json({ ok: true, hint: 'POST person_id to upsert minimal points' });
}

// Handler principale
export async function POST(req: Request) {
  const supabase = createSupabaseServerRouteClient();

  let stage: string = 'auth';
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized', stage }, { status: 401 });

  try {
    stage = 'body';
    const body = (await req.json()) as MinimalReq;
    const person_id = body.person_id;
    if (!person_id) return NextResponse.json({ error: 'missing person_id', stage }, { status: 400 });

    stage = 'fetch-person';
    const { data: p, error: perErr } = await supabase
      .from('people')
      .select('id,birth_date,birth_time,birth_tz_offset_minutes,birth_lat,birth_lon')
      .eq('id', person_id)
      .maybeSingle();
    if (perErr) return NextResponse.json({ error: perErr.message, stage }, { status: 500 });
    if (!p?.birth_date) return NextResponse.json({ error: 'person missing birth_date', stage }, { status: 400 });

    const birth_time = p.birth_time && p.birth_time.trim() !== '' ? p.birth_time : null;
    const tz = Number(p.birth_tz_offset_minutes ?? 0);
    const dateUTC = makeUTC(p.birth_date, birth_time, tz);

    // 1) SUN: se manca, stimiamo e upsertiamo
    stage = 'sun-read';
    const { data: sunRow } = await supabase
      .from('people_chart_points')
      .select('id,longitude')
      .eq('person_id', person_id)
      .in('name', ['Sun', 'Sole', '☉', 'SUN', 'sun'])
      .maybeSingle();

    const upsertRows: Array<{ person_id: string; name: string; longitude: number }> = [];
    let approxSun = false;

    if (!sunRow?.longitude || !Number.isFinite(Number(sunRow.longitude))) {
      stage = 'sun-approx';
      const sunLon = approxSunLongitudeUTC(dateUTC);
      approxSun = true;
      upsertRows.push({ person_id, name: 'Sun', longitude: sunLon });
    }

    if (upsertRows.length === 0) {
      return NextResponse.json({ ok: true, upserted: 0, approxSun } satisfies MinimalResp);
    }

    stage = 'upsert';
    const { error: upErr } = await supabase
      .from('people_chart_points')
      .upsert(upsertRows, { onConflict: 'person_id,name' });
    if (upErr) return NextResponse.json({ error: upErr.message, stage }, { status: 500 });

    return NextResponse.json({ ok: true, upserted: upsertRows.length, approxSun } satisfies MinimalResp);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error)?.message ?? 'unknown error', stage },
      { status: 500 }
    );
  }
}
