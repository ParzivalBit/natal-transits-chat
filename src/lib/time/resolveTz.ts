// src/lib/time/resolveTz.ts
// Helper server-side: dato (lat, lon, data locale, ora locale) risolve la timezone IANA
// e calcola l'offset (in minuti) valido in quel momento (gestisce automaticamente il DST).
//
// Dipendenze: luxon, tz-lookup
//   npm i tz-lookup
//
// Uso tipico:
//   const { tz_name, offset_minutes } = resolveTimezoneForLocalMoment(lat, lon, "1988-01-31", "12:34");

import { DateTime } from 'luxon';
import tzlookup from 'tz-lookup';

export type ResolvedTz = {
  tz_name: string;         // es. "Europe/Rome"
  offset_minutes: number;  // minuti da UTC, es. 60 o 120 a seconda del DST
};

export function resolveTimezoneForLocalMoment(
  lat: number,
  lon: number,
  dateISO: string,  // "YYYY-MM-DD"
  timeHHMM: string  // "HH:MM" (ora locale)
): ResolvedTz {
  // 1) timezone IANA dal punto geografico
  const tz_name = tzlookup(lat, lon);

  // 2) offset specifico di QUELLA data/ora locale (DST incluso)
  //    Luxon usa i dati tzdb della IANA per calcolare l'offset corretto.
  const dtLocal = DateTime.fromISO(`${dateISO}T${timeHHMM}`, { zone: tz_name });
  const offset_minutes = dtLocal.offset; // minuti (int)

  return { tz_name, offset_minutes };
}
