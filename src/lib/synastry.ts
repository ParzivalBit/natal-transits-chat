// src/lib/synastry.ts
import { normalizeDeg, type AspectType, type PointName } from '@/lib/astro';

export type NatalPointLite = { name: PointName; longitude: number };

export type SynAspect = {
  a_point: PointName;
  b_point: PointName;
  aspect: AspectType;
  orb: number;   // degrees
  score: number; // 0..1
};

const ASPECT_DEGREES: Record<AspectType, number> = {
  conjunction: 0,
  sextile: 60,
  square: 90,
  trine: 120,
  opposition: 180,
};

function minAngle(a: number, b: number): number {
  let d = Math.abs(normalizeDeg(a - b));
  if (d > 180) d = 360 - d;
  return d;
}

function classOfPoint(name: PointName): 'lum' | 'pers' | 'soc' | 'out' | 'ang' {
  if (name === 'Sun' || name === 'Moon') return 'lum';
  if (name === 'Mercury' || name === 'Venus' || name === 'Mars') return 'pers';
  if (name === 'Jupiter' || name === 'Saturn') return 'soc';
  if (name === 'Uranus' || name === 'Neptune' || name === 'Pluto') return 'out';
  return 'ang'; // ASC/MC
}

function maxOrb(p1: PointName, p2: PointName): number {
  const c1 = classOfPoint(p1);
  const c2 = classOfPoint(p2);
  if (c1 === 'lum' || c2 === 'lum') return 6;
  if (c1 === 'pers' || c2 === 'pers' || c1 === 'ang' || c2 === 'ang') return 5;
  return 3;
}

function aspectWeight(a: AspectType): number {
  switch (a) {
    case 'conjunction': return 1.00;
    case 'opposition':  return 0.95;
    case 'trine':       return 0.90;
    case 'square':      return 0.85;
    case 'sextile':     return 0.75;
  }
}

function pointWeight(p: PointName): number {
  switch (classOfPoint(p)) {
    case 'lum': return 1.00;
    case 'ang': return 0.95;
    case 'pers': return 0.90;
    case 'soc': return 0.80;
    case 'out': return 0.70;
  }
}

export function computeSynastryAspects(a: NatalPointLite[], b: NatalPointLite[]): SynAspect[] {
  const res: SynAspect[] = [];
  const aspects: AspectType[] = ['conjunction','sextile','square','trine','opposition'];
  for (const A of a) {
    for (const B of b) {
      const d = minAngle(A.longitude, B.longitude);
      let best: { asp: AspectType; diff: number } | null = null;
      for (const asp of aspects) {
        const diff = Math.abs(d - ASPECT_DEGREES[asp]);
        if (!best || diff < best.diff) best = { asp, diff };
      }
      if (!best) continue;
      const max = maxOrb(A.name, B.name);
      if (best.diff <= max) {
        const score = aspectWeight(best.asp) * pointWeight(A.name) * pointWeight(B.name);
        res.push({
          a_point: A.name,
          b_point: B.name,
          aspect: best.asp,
          orb: +best.diff.toFixed(2),
          score: +score.toFixed(3),
        });
      }
    }
  }
  res.sort((A, B) => (B.score - A.score) || (A.orb - B.orb));
  return res;
}

export function formatSynastryContext(top: SynAspect[], labelA: string, labelB: string): string {
  const lines = top.map(s =>
    `${labelA}:${s.a_point} ${s.aspect} ${labelB}:${s.b_point} (orb ${s.orb}°, score ${Math.round(s.score*100)})`
  );
  return `CONTEXT_SYNASTRY\n${lines.join('\n')}`;
}
