// src/components/astro/labeling.ts

export type LabeledPoint = {
  name: string;          // 'Sun' | 'Venus' | ...
  lon: number;           // 0..360 (gradi eclittici)
  baseR: number;         // raggio base del glifo
};

export type DisplayPoint = LabeledPoint & {
  r: number;             // raggio effettivo per il glifo (dopo anti-overlap)
  level: number;         // livello di "scalino"
};

/**
 * Radial staggering:
 * - ordina per longitudine
 * - se due consecutivi sono più vicini di minSepDeg, alza il successivo di uno "step" radiale
 * - resetta il livello quando la distanza torna sufficiente
 */
export function radialStagger(
  points: LabeledPoint[],
  minSepDeg = 2.0,   // distanza angolare minima tra glifi sullo stesso raggio
  stepPx    = 8,     // incremento radiale per ogni livello
  maxLevels = 3      // prevenire allontanamenti eccessivi
): DisplayPoint[] {
  if (points.length <= 1) return points.map(p => ({ ...p, r: p.baseR, level:0 }));

  const sorted = [...points].sort((a,b)=>a.lon-b.lon);
  let prev = sorted[0];
  let level = 0;
  const out: DisplayPoint[] = [{ ...prev, r: prev.baseR, level }];

  for (let i=1; i<sorted.length; i++){
    const cur = sorted[i];
    const delta = Math.min(
      Math.abs(cur.lon - prev.lon),
      360 - Math.abs(cur.lon - prev.lon)
    );
    if (delta < minSepDeg) {
      level = Math.min(level + 1, maxLevels);
    } else {
      level = 0;
    }
    out.push({ ...cur, r: cur.baseR + level*stepPx, level });
    prev = cur;
  }
  return out;
}
