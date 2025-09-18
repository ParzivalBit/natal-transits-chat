// src/lib/geo.ts
import { DateTime } from 'luxon';
import tzLookup from 'tz-lookup';

export type GeoSearchItem = {
  place_id: string;
  display_name: string;
  name?: string;
  lat: number;
  lon: number;
  type?: string;
  class?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
};

type CacheEntry<T> = { value: T; expires: number };

const ONE_HOUR = 60 * 60 * 1000;
const CACHE_TTL_MS = ONE_HOUR;
const RATE_LIMIT_MS = 1100;

declare global {
  // eslint-disable-next-line no-var
  var __geoCache: Map<string, CacheEntry<unknown>> | undefined;
  // eslint-disable-next-line no-var
  var __lastNominatimFetch: number | undefined;
}

if (!globalThis.__geoCache) globalThis.__geoCache = new Map<string, CacheEntry<unknown>>();
if (typeof globalThis.__lastNominatimFetch !== 'number') globalThis.__lastNominatimFetch = 0;

const cache = globalThis.__geoCache as Map<string, CacheEntry<unknown>>;

function setCache<T>(key: string, value: T, ttlMs = CACHE_TTL_MS): void {
  cache.set(key, { value, expires: Date.now() + ttlMs });
}

function getCache<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value as T;
}

async function respectRateLimit(): Promise<void> {
  const last = globalThis.__lastNominatimFetch ?? 0;
  const since = Date.now() - last;
  if (since < RATE_LIMIT_MS) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - since));
  }
}

function toStringSafe(v: unknown): string {
  return typeof v === 'string' ? v : String(v ?? '');
}

function toNumberSafe(v: unknown): number {
  const n = Number(v);
  if (Number.isFinite(n)) return n;
  const s = toStringSafe(v);
  const pf = parseFloat(s);
  return Number.isFinite(pf) ? pf : NaN;
}

export async function nominatimSearch(q: string, limit = 5): Promise<GeoSearchItem[]> {
  const base = process.env.GEOCODING_BASE_URL || 'https://nominatim.openstreetmap.org';
  const email = process.env.GEOCODING_EMAIL;
  const key = `nominatim:${q}:${limit}`;

  const cached = getCache<GeoSearchItem[]>(key);
  if (cached) return cached;

  await respectRateLimit();

  const url = new URL(`${base}/search`);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('q', q);
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', String(limit));
  if (email) url.searchParams.set('email', email);

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': `NatalTransitsChat/0.1 (${email || 'no-email-provided'})` },
  });
  globalThis.__lastNominatimFetch = Date.now();

  if (!res.ok) throw new Error(`Nominatim error ${res.status}`);

  const data: unknown = await res.json();
  if (!Array.isArray(data)) throw new Error('Unexpected Nominatim response (not an array)');

  const items: GeoSearchItem[] = data.map((r: unknown) => {
    const rr = (r ?? {}) as Record<string, unknown>;
    const addr = (rr.address ?? {}) as Record<string, unknown>;
    return {
      place_id: toStringSafe(rr.place_id),
      display_name: toStringSafe(rr.display_name),
      name: rr.name === undefined ? undefined : toStringSafe(rr.name),
      lat: toNumberSafe(rr.lat),
      lon: toNumberSafe(rr.lon),
      type: rr.type === undefined ? undefined : toStringSafe(rr.type),
      class: rr.class === undefined ? undefined : toStringSafe(rr.class),
      address: {
        city:
          addr.city !== undefined
            ? toStringSafe(addr.city)
            : addr.town !== undefined
            ? toStringSafe(addr.town)
            : addr.village !== undefined
            ? toStringSafe(addr.village)
            : undefined,
        state: addr.state === undefined ? undefined : toStringSafe(addr.state),
        country: addr.country === undefined ? undefined : toStringSafe(addr.country),
        country_code: addr.country_code === undefined ? undefined : toStringSafe(addr.country_code),
      },
    };
  });

  setCache(key, items);
  return items;
}

export function tzNameFromLatLon(lat: number, lon: number): string | null {
  try {
    const z = tzLookup(lat, lon);
    return typeof z === 'string' && z.length > 0 ? z : null;
  } catch {
    return null;
  }
}

/**
 * Offset in minuti da UTC per una data/ora locale.
 * @param isoDate YYYY-MM-DD
 * @param hhmm HH:MM (24h)
 * @param tzName es. "Europe/Rome"
 */
export function tzOffsetMinutes(isoDate: string, hhmm: string, tzName: string): number | null {
  if (!isoDate || !hhmm || !tzName) return null;
  const dt = DateTime.fromISO(`${isoDate}T${hhmm}`, { zone: tzName });
  return dt.isValid ? dt.offset : null;
}
