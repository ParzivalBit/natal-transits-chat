// src/lib/houses/whole.ts
// Cuspidi Whole Sign a partire dall'ASC e MC (entrambi gradi eclittici).

import { normalizeAngle } from './common';

export type WholeResult = {
  system: 'whole';
  cusps: number[]; // 12 valori: I..XII
  asc: number;
  mc: number;
  fallbackApplied?: boolean;
};

/** Cuspidi Whole Sign: cusp I = inizio del segno dell'ASC, poi ogni 30°. */
export function computeWholeCuspsFromAsc(ascDeg: number, mcDeg: number): WholeResult {
  const ascSignStart = Math.floor(normalizeAngle(ascDeg) / 30) * 30;
  const cusps = Array.from({ length: 12 }, (_, i) => normalizeAngle(ascSignStart + i * 30));
  return {
    system: 'whole',
    cusps,
    asc: normalizeAngle(ascDeg),
    mc: normalizeAngle(mcDeg),
  };
}
