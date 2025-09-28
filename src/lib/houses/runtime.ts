// src/lib/houses/runtime.ts
import { computeHouses } from '@/lib/astro';

export type HouseSystem = 'whole' | 'placidus';

export function jdFromUTC(dateUTC: Date): number {
  // JD = 2440587.5 + msUTC/86400000
  return 2440587.5 + dateUTC.getTime() / 86400000;
}

/**
 * Calcola runtime le cuspidi case per una data UTC e coordinate geografiche.
 * Nessuna persistenza su DB.
 */
export function computeHousesForDateUTC(params: {
  system: HouseSystem;
  dateUTC: Date;          // data/ora in UTC
  latDeg: number;
  lonDeg: number;
}): { cusps: number[]; asc: number; mc: number; system: HouseSystem; fallbackApplied: boolean } {
  const { system, dateUTC, latDeg, lonDeg } = params;
  const jd = jdFromUTC(dateUTC);
  // tzMinutes non serve al calcolo case (si usa JD UT); lo forniamo per compatibilità con la firma
  const res = computeHouses(system, { jd, latDeg, lonDeg, tzMinutes: 0 });

  // Se Placidus e latitudine estrema, la nostra implementazione fa fallback a Whole Sign:
  const fallbackApplied = system === 'placidus' && Math.abs(latDeg) > 66.5;

  return {
    cusps: res.cusps,
    asc: res.asc,
    mc: res.mc,
    system,
    fallbackApplied,
  };
}

// append to: src/lib/houses/runtime.ts
import { DateTime } from 'luxon';

export async function computePersonHousesForUserSystem(params: {
  person: {
    birth_date: string;           // YYYY-MM-DD
    birth_time?: string | null;   // HH:MM
    tz_offset_minutes?: number | null;
    lat: number;
    lon: number;
  };
  userHouseSystem: HouseSystem;   // 'whole' | 'placidus'
}) {
  const { person, userHouseSystem } = params;
  if (!person?.birth_date || person.lat == null || person.lon == null) {
    return { system: userHouseSystem, cusps: undefined, asc: undefined, mc: undefined, fallbackApplied: false };
  }
  const hhmm = person.birth_time ?? '12:00';
  const off = person.tz_offset_minutes ?? 0;

  const local = DateTime.fromISO(`${person.birth_date}T${hhmm}:00`, { zone: 'UTC' }).toJSDate();
  // correggo l'UTC applicando l'offset (minuti) memorizzato
  const dateUTC = new Date(local.getTime() - off * 60_000);

  const res = computeHousesForDateUTC({
    system: userHouseSystem,
    dateUTC,
    latDeg: person.lat,
    lonDeg: person.lon,
  });
  return res;
}
