// src/lib/time.ts
import { DateTime } from 'luxon';

export function getDefaultTZ(): string {
  return process.env.DEFAULT_TZ || 'UTC';
}

export function todayISOInTZ(tz?: string): string {
  const zone = tz || getDefaultTZ();
  return DateTime.now().setZone(zone).toFormat('yyyy-LL-dd'); // YYYY-MM-DD
}

export function nowInfo(tz?: string) {
  const zone = tz || getDefaultTZ();
  const dt = DateTime.now().setZone(zone);
  return {
    tz: zone,
    now_iso: dt.toISO(),
    now_human: dt.toFormat('cccc, dd LLL yyyy HH:mm'),
    utc_offset_minutes: dt.offset, // es. +120 per CEST
  };
}
