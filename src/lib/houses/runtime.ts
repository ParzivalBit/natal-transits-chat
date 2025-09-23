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
