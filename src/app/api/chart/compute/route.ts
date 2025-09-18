// src/app/api/chart/compute/route.ts
import { NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import { createSupabaseServerRouteClient } from '@/lib/supabaseServer';
import { computePoints, computeNatalAspects, type Point } from '@/lib/astro';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type BodyIn = {
  name?: string | null;
  date?: string | null;       // YYYY-MM-DD (obbligatorio)
  time?: string | null;       // HH:MM (opzionale)
  place_name?: string | null;
  lat?: number | string | null;
  lon?: number | string | null;
  tz_name?: string | null;    // es. Europe/Rome (opzionale)
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

function toNumber(x: unknown): number | null {
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  if (typeof x === 'string' && x.trim() !== '' && Number.isFinite(Number(x))) return Number(x);
  return null;
}

/** Offset minuti della TZ alla data/ora (se disponibili) */
function offsetMinutes(date: string | null, time: string | null, tz: string | null): number | null {
  if (!tz) return null;
  const iso = date ? `${date}T${time || '12:00'}` : undefined;
  const dt = iso ? DateTime.fromISO(iso, { zone: tz }) : DateTime.now().setZone(tz);
  return Number.isFinite(dt.offset) ? dt.offset : null;
}

/** planet | angle in base al nome del punto */
function pointKind(p: Point): 'planet' | 'angle' {
  return p.name === 'ASC' || p.name === 'MC' ? 'angle' : 'planet';
}

export async function POST(req: Request) {
  try {
    const supabase = createSupabaseServerRouteClient();

    // 1) Auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return bad('Not authenticated', 401);
    const user_id = user.id;

    // 2) Input
    const b = (await req.json().catch(() => ({}))) as BodyIn;
    const name = (b.name || '').toString().trim();
    const date = (b.date || '').toString().trim();           // YYYY-MM-DD
    const timeIn = b.time ? String(b.time) : null;           // HH:MM | null
    const place_name = (b.place_name || '').toString().trim();
    const latNum = toNumber(b.lat);
    const lonNum = toNumber(b.lon);
    const tz_name = (b.tz_name || null) as string | null;

    if (!name) return bad('Missing name');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad('Invalid date (YYYY-MM-DD required)');
    if (timeIn && !/^\d{2}:\d{2}$/.test(timeIn)) return bad('Invalid time (HH:MM)');
    if (!place_name) return bad('Missing place_name');
    if (latNum === null || lonNum === null) return bad('Missing coordinates');

    // 3) TZ e orario “sicuri”
    const tz: string = tz_name ?? 'UTC';
    const timeSafe: string = typeof timeIn === 'string' ? timeIn : '12:00';

    // 4) Offset e timestamp (info/debug)
    const tz_off = offsetMinutes(date, timeSafe, tz) ?? 0;
    const dtLocal = DateTime.fromISO(`${date}T${timeSafe}`, { zone: tz });
    const epochMillis = dtLocal.toUTC().toMillis();

    // 5) Calcola punti e aspetti
    // >>> ORDINE CORRETTO: (tzName, dateISO, timeHHMM, lat, lon)
    const {
      points,
      houses,
      timestampUTC,
    }: {
      points: Point[];
      houses: boolean;
      timestampUTC: Date;
    } = computePoints(tz, date, timeSafe, latNum, lonNum);

    const aspects = computeNatalAspects(points);

    // 6) Persistenza
    // 6.1 birth_data (upsert per user_id)
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
            lat: latNum,
            lon: lonNum,
          },
          { onConflict: 'user_id' }
        );
      if (error) throw new Error(`birth_data upsert: ${error.message}`);
    }

    // 6.2 chart_points
    {
      const del = await supabase.from('chart_points').delete().eq('user_id', user_id);
      if (del.error) throw new Error(`chart_points delete: ${del.error.message}`);

      const rows = points.map((p) => ({
        user_id,
        kind: pointKind(p),                 // 'planet' oppure 'angle'
        name: p.name,
        longitude: p.longitude,
        sign: p.sign,
        house: p.house ?? null,
        retro: p.retro ?? false,
      }));

      if (rows.length) {
        const ins = await supabase.from('chart_points').insert(rows);
        if (ins.error) throw new Error(`chart_points insert: ${ins.error.message}`);
      }
    }

    // 6.3 natal_aspects
    {
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
    }

    // 7) Done
    return NextResponse.json({
      ok: true,
      info: {
        housesComputed: houses,
        timestampUTC,
        epochMillis,
      },
      saved: {
        birth_data: { name, date, time: timeSafe, place_name, tz_offset_minutes: tz_off },
        points: points.length,
        aspects: aspects.length,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (process.env.NODE_ENV !== 'production') console.error('[chart/compute] ERROR:', err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
