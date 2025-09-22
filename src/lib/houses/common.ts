// src/lib/houses/common.ts
// Utility comuni e tipi per i sistemi di case. MIT-compatible.

export type HouseSystem = 'whole' | 'placidus';

/** Converte gradi → radianti. */
export function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

/** Converte radianti → gradi. */
export function rad2deg(r: number): number {
  return (r * 180) / Math.PI;
}

/** Normalizza un angolo in gradi nell'intervallo [0, 360). */
export function normalizeAngle(deg: number): number {
  let x = deg % 360;
  if (x < 0) x += 360;
  return x;
}

/** Restituisce true se angolo b è tra a (incluso) e c (escluso) muovendosi in senso crescente modulare 360°. */
export function isBetweenAngles(a: number, b: number, c: number): boolean {
  a = normalizeAngle(a);
  b = normalizeAngle(b);
  c = normalizeAngle(c);
  if (a === c) return true; // l'intervallo copre l'intero cerchio
  if (a < c) {
    return b >= a && b < c;
  } else {
    // wrap-around
    return b >= a || b < c;
  }
}

/** Clamp numerico semplice. */
export function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}

/** True se latitudine è in zona critica per Placidus (non definito/instabile). */
export function isExtremeLatitude(latDeg: number): boolean {
  // Soglia prudenziale: Circoli Polari ~66.56°, lasciamo margine
  return Math.abs(latDeg) > 66.5;
}

/** Errore specifico per latitudini estreme/unsupported. */
export class PlacidusUnsupportedLatitudeError extends Error {
  constructor(latDeg: number) {
    super(
      `Placidus non supportato/instabile a latitudine ${latDeg.toFixed(
        4
      )}°. Applicare fallback (Whole Sign).`
    );
    this.name = 'PlacidusUnsupportedLatitudeError';
  }
}
