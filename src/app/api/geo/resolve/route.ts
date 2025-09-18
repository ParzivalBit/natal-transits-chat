// src/app/api/geo/resolve/route.ts
import { NextResponse } from 'next/server';
import tzLookup from 'tz-lookup';
import { DateTime } from 'luxon';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  state?: string;
  region?: string;
  country?: string;
  [k: string]: unknown;
};

type NominatimItem = {
  lat: string;                 // Nominatim usa stringhe
  lon: string;
  display_name?: string;
  address?: NominatimAddress;
};

function parseLatLon(q: string): { lat: number; lon: number } | null {
  const parts = q.split(',').map(s => s.trim());
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lon = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

function computeOffsetMinutes(date: string | null, time: string | null, tz: string | null): number | null {
  if (!tz) return null;
  const iso = date ? `${date}T${time || '12:00'}` : undefined;
  const dt = iso ? DateTime.fromISO(iso, { zone: tz }) : DateTime.now().setZone(tz);
  return Number.isFinite(dt.offset) ? dt.offset : null; // offset (minuti)
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const date = searchParams.get('date'); // YYYY-MM-DD (opzionale)
    const time = searchParams.get('time'); // HH:MM (opzionale)

    if (!q) return NextResponse.json({ ok: false, error: 'Missing q' }, { status: 400 });

    let lat: number;
    let lon: number;
    let display_name = '';
    let address: NominatimAddress | null = null;

    const latlon = parseLatLon(q);
    if (latlon) {
      lat = latlon.lat;
      lon = latlon.lon;
      display_name = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    } else {
      const base = process.env.GEOCODING_BASE_URL?.replace(/\/+$/, '') || 'https://nominatim.openstreetmap.org';
      const url = `${base}/search?format=jsonv2&addressdetails=1&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'NatalTransitsApp/0.1 (+dev)',
          'Accept-Language': 'en',
        },
        cache: 'no-store',
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Nominatim error ${res.status}: ${txt.slice(0, 120)}`);
      }
      const raw: unknown = await res.json();
      if (!Array.isArray(raw) || raw.length === 0) {
        return NextResponse.json({ ok: false, error: 'No results' }, { status: 404 });
      }
      const arr = raw as NominatimItem[];
      const best = arr[0];

      const latNum = Number(best.lat);
      const lonNum = Number(best.lon);
      if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
        return NextResponse.json({ ok: false, error: 'Invalid coordinates from provider' }, { status: 502 });
      }

      lat = latNum;
      lon = lonNum;
      display_name = best.display_name || q;
      address = best.address ?? null;
    }

    let timezone: string | null = null;
    try { timezone = tzLookup(lat, lon); } catch { timezone = null; }

    const tz_offset_minutes = computeOffsetMinutes(date, time, timezone);

    const city = address?.city || address?.town || address?.village || address?.hamlet || null;
    const state = address?.state || address?.region || null;
    const country = address?.country || null;

    return NextResponse.json({
      ok: true,
      query: q,
      result: {
        display_name,
        lat,
        lon,
        city,
        state,
        country,
        timezone,
        tz_offset_minutes,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (process.env.NODE_ENV !== 'production') console.error('[geo/resolve] ERROR:', err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
