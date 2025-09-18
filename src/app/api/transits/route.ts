// src/app/api/transits/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerComponentClient } from '@/lib/supabaseServer';
import * as Astronomy from 'astronomy-engine';

type Point = {
  name: string;             // natal point (Sun..Pluto, ASC, MC)
  longitude: number;        // 0..360
  sign: string;
  house: number | null;
  retro: boolean;
};

// ───────── helpers (indipendenti) ─────────
const OBLIQUITY = (23.4392911 * Math.PI) / 180;

function normalizeDeg(x: number): number {
  let d = x % 360;
  if (d < 0) d += 360;
  return d;
}
function rad(d: number): number { return (d * Math.PI) / 180; }
function deg(r: number): number { return (r * 180) / Math.PI; }

function eclipticFromEquatorial(eq: Astronomy.EquatorialCoordinates): { elon: number; elat: number } {
  const ra = eq.ra * 15; // h→deg
  const dec = eq.dec;
  const raRad = rad(ra);
  const decRad = rad(dec);
  const sinE = Math.sin(OBLIQUITY);
  const cosE = Math.cos(OBLIQUITY);
  const sinDec = Math.sin(decRad);
  const cosDec = Math.cos(decRad);
  const sinRa = Math.sin(raRad);
  const cosRa = Math.cos(raRad);
  const elat = Math.asin(sinDec * cosE - cosDec * sinE * sinRa);
  const y = sinRa * cosE + Math.tan(decRad) * sinE;
  const x = cosRa;
  const elon = Math.atan2(y, x);
  return { elon: normalizeDeg(deg(elon)), elat: deg(elat) };
}

function geoEclLon(body: Astronomy.Body, date: Date): number {
  const vec = Astronomy.GeoVector(body, date, true);
  const eq = Astronomy.EquatorFromVector(vec);
  const ecl = eclipticFromEquatorial(eq);
  return ecl.elon;
}

function minAngle(a: number, b: number): number {
  let d = Math.abs(normalizeDeg(a - b));
  if (d > 180) d = 360 - d;
  return d;
}

// Tipi degli aspetti forti
const ASPECTS = {
  conjunction: 0,
  sextile: 60,
  square: 90,
  trine: 120,
  opposition: 180,
} as const;

type AspectKey = keyof typeof ASPECTS;

function classOfPoint(name: string): 'lum' | 'pers' | 'soc' | 'out' | 'ang' {
  if (name === 'Sun' || name === 'Moon') return 'lum';
  if (name === 'Mercury' || name === 'Venus' || name === 'Mars') return 'pers';
  if (name === 'Jupiter' || name === 'Saturn') return 'soc';
  if (name === 'Uranus' || name === 'Neptune' || name === 'Pluto') return 'out';
  return 'ang'; // ASC/MC
}

function orbMax(p1: string, p2: string): number {
  const c1 = classOfPoint(p1);
  const c2 = classOfPoint(p2);
  if (c1 === 'lum' || c2 === 'lum') return 6;
  if (c1 === 'pers' || c2 === 'pers' || c1 === 'ang' || c2 === 'ang') return 5;
  return 3;
}

function aspectWeight(a: AspectKey): number {
  switch (a) {
    case 'conjunction': return 1.00;
    case 'opposition':  return 0.95;
    case 'trine':       return 0.90;
    case 'square':      return 0.85;
    case 'sextile':     return 0.75;
    default:            return 0.80; // fallback di sicurezza (non dovrebbe mai servire)
  }
}

function pointWeight(p: string): number {
  const c = classOfPoint(p);
  switch (c) {
    case 'lum': return 1.00;
    case 'ang': return 0.95;
    case 'pers': return 0.90;
    case 'soc': return 0.80;
    case 'out': return 0.70;
    default:    return 0.80;
  }
}

type TransitHit = {
  date: string;             // YYYY-MM-DD
  t_planet: string;         // transiting planet
  n_point: string;          // natal point
  aspect: AspectKey;        // unione tipizzata
  orb: number;              // deg
  score: number;            // 0..100 approx
};

// ───────── GET handler ─────────
export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseServerComponentClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date'); // YYYY-MM-DD
    const limit = Math.max(1, Math.min(99, Number(searchParams.get('limit') ?? 5)));

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ ok: false, error: 'Missing or invalid date (YYYY-MM-DD)' }, { status: 400 });
    }

    // 1) Carica punti natali
    const { data: natal } = await supabase
      .from('chart_points')
      .select('name,longitude,sign,house,retro')
      .eq('user_id', user.id);

    const natalPoints = Array.isArray(natal) ? (natal as Point[]) : [];
    if (natalPoints.length === 0) {
      return NextResponse.json({ ok: true, top: [] });
    }

    // 2) Calcola posizioni transitanti del giorno (UT)
    const when = new Date(`${date}T00:00:00.000Z`);
    const transitBodies: { name: string; body: Astronomy.Body }[] = [
      { name: 'Sun', body: Astronomy.Body.Sun },
      { name: 'Moon', body: Astronomy.Body.Moon },
      { name: 'Mercury', body: Astronomy.Body.Mercury },
      { name: 'Venus', body: Astronomy.Body.Venus },
      { name: 'Mars', body: Astronomy.Body.Mars },
      { name: 'Jupiter', body: Astronomy.Body.Jupiter },
      { name: 'Saturn', body: Astronomy.Body.Saturn },
      { name: 'Uranus', body: Astronomy.Body.Uranus },
      { name: 'Neptune', body: Astronomy.Body.Neptune },
      { name: 'Pluto', body: Astronomy.Body.Pluto },
    ];
    const transiting = transitBodies.map(({ name, body }) => ({
      name,
      longitude: geoEclLon(body, when),
    }));

    // 3) Match aspetti T (transitanti) → N (natali)
    const hits: TransitHit[] = [];
    const aspectKeys = Object.keys(ASPECTS) as AspectKey[];
    for (const t of transiting) {
      for (const n of natalPoints) {
        const d = minAngle(t.longitude, n.longitude);
        // trova l'aspetto più vicino
        let best: { a: AspectKey; diff: number } | null = null;
        for (const ak of aspectKeys) {
          const target = ASPECTS[ak];
          const diff = Math.abs(d - target);
          if (!best || diff < best.diff) best = { a: ak, diff };
        }
        if (!best) continue;
        const maxOrb = orbMax(t.name, n.name);
        if (best.diff <= maxOrb) {
          const aw = aspectWeight(best.a);
          const pw = pointWeight(t.name) * pointWeight(n.name);
          const tight = 1 - best.diff / maxOrb;
          const score = Math.round(100 * aw * pw * (0.6 + 0.4 * tight));
          hits.push({
            date,
            t_planet: t.name,
            n_point: n.name,
            aspect: best.a,                       // <-- ora tipizzato correttamente
            orb: Number(best.diff.toFixed(2)),
            score,
          });
        }
      }
    }

    // 4) Ordina per score, salva cache giornaliera e ritorna top
    hits.sort((a, b) => b.score - a.score);

    // Aggiorna cache (best-effort)
    await supabase
      .from('transit_events')
      .delete()
      .eq('user_id', user.id)
      .eq('date', date);

    if (hits.length > 0) {
      const rows = hits.map(h => ({
        user_id: user.id,
        date: h.date,
        t_planet: h.t_planet,
        n_point: h.n_point,
        aspect: h.aspect,
        orb: h.orb,
        score: h.score,
      }));
      await supabase.from('transit_events').insert(rows);
    }

    return NextResponse.json({ ok: true, top: hits.slice(0, limit) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[api/transits] ERROR:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
