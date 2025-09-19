// src/app/api/people/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { DateTime } from 'luxon';

// usa import RELATIVI per evitare problemi con l'alias "@"
import { createSupabaseServerRouteClient } from '../../../lib/supabaseServer';
import { computePoints, computeNatalAspects, type Point } from '../../../lib/astro';

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

// GET /api/people -> lista persone dell’utente
export async function GET() {
  const supabase = createSupabaseServerRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return bad('Unauthorized', 401);

  const { data, error } = await supabase
    .from('people')
    .select('id,label,birth_date,birth_place_name')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) return bad(error.message, 500);
  return NextResponse.json({ ok: true, items: data ?? [] });
}

// POST /api/people -> crea persona + calcola punti/aspetti
type PostBody = {
  label: string;
  date: string;      // YYYY-MM-DD
  time?: string|null;// HH:MM
  place_name?: string|null;
  lat?: number|null;
  lon?: number|null;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return bad('Unauthorized', 401);

    const body = (await req.json()) as PostBody;
    const label = (body.label || '').trim();
    const date = (body.date || '').trim();
    const time = (body.time || '')?.trim() || null;
    const place_name = (body.place_name || '')?.trim() || null;
    const lat = Number.isFinite(Number(body.lat)) ? Number(body.lat) : null;
    const lon = Number.isFinite(Number(body.lon)) ? Number(body.lon) : null;

    if (!label) return bad('Missing label');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad('Invalid date');
    if (time && !/^\d{2}:\d{2}$/.test(time)) return bad('Invalid time');

    // MVP: timezone di default
    const tz_name = 'UTC';
    const when = DateTime.fromISO(`${date}T${time || '12:00'}`, { zone: tz_name });

    // 1) inserisci persona
    const { data: inserted, error: e1 } = await supabase
      .from('people')
      .insert({
        user_id: user.id,
        label,
        birth_date: date,
        birth_time: time,
        birth_tz_name: tz_name,
        birth_tz_offset_minutes: when.offset, // minuti
        birth_place_name: place_name,
        birth_lat: lat,
        birth_lon: lon,
      })
      .select('id')
      .single();

    if (e1) return bad(e1.message, 500);
    const person_id = inserted!.id as string;

    // 2) calcola punti/aspetti e salva
    const { points }: { points: Point[] } = computePoints(tz_name, date, time || '12:00', lat ?? 0, lon ?? 0);
    const aspects = computeNatalAspects(points);

    if (points.length) {
      const rows = points.map(p => ({
        person_id,
        name: p.name,
        longitude: p.longitude,
        sign: p.sign,
        house: p.house ?? null,
        retro: p.retro ?? false,
      }));
      const ins1 = await supabase.from('people_chart_points').insert(rows);
      if (ins1.error) return bad(ins1.error.message, 500);
    }

    if (aspects.length) {
      const rows = aspects.map(a => ({
        person_id,
        p1: a.p1,
        p2: a.p2,
        aspect: a.aspect,
        orb: a.orb,
        strength: a.strength,
      }));
      const ins2 = await supabase.from('people_natal_aspects').insert(rows);
      if (ins2.error) return bad(ins2.error.message, 500);
    }

    return NextResponse.json({ ok: true, id: person_id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return bad(msg, 500);
  }
}
