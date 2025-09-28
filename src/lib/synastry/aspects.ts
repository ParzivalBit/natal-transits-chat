// src/lib/synastry/aspects.ts
import { wrapDeg } from '@/lib/graphics/polar';
import type { PlanetName } from '@/lib/graphics/glyphs';

export type AspectName =
  | 'conjunction' | 'opposition' | 'trine' | 'square' | 'sextile'
  | 'quincunx' | 'semi-sextile';

export type ChartPoint = {
  name: PlanetName | 'ASC' | 'MC';
  lon: number;        // 0..360
  retro?: boolean;
};

export type SynastryAspect = {
  a: { owner: 'user' | 'person'; name: ChartPoint['name']; lon: number };
  b: { owner: 'user' | 'person'; name: ChartPoint['name']; lon: number };
  aspect: AspectName;
  exact: number;      // 0,60,90,120,150,180
  orb: number;        // |delta| in gradi
  applying: boolean;  // stima (runtime)
  score: number;      // 0..1
};

const ASPECT_DEG: Record<AspectName, number> = {
  conjunction: 0, sextile: 60, square: 90, trine: 120,
  quincunx: 150, opposition: 180, 'semi-sextile': 30,
};

// orbi massimi (luminari > personali/angoli > sociali > lenti)
function classOf(p: ChartPoint['name']) {
  if (p === 'Sun' || p === 'Moon') return 'lum';
  if (p === 'Mercury' || p === 'Venus' || p === 'Mars') return 'pers';
  if (p === 'Jupiter' || p === 'Saturn') return 'soc';
  if (p === 'Uranus' || p === 'Neptune' || p === 'Pluto') return 'out';
  return 'ang';
}
function maxOrb(p1: ChartPoint['name'], p2: ChartPoint['name'], a: AspectName): number {
  const c1 = classOf(p1), c2 = classOf(p2);
  const base =
    (c1 === 'lum' || c2 === 'lum') ? 8 :
    (c1 === 'pers' || c2 === 'pers' || c1 === 'ang' || c2 === 'ang') ? 6 :
    4;
  // aspetti minori: orb leggermente ridotto
  if (a === 'quincunx' || a === 'semi-sextile') return Math.max(2, base - 2);
  return base;
}

function minAngle(a: number, b: number): number {
  const raw = Math.abs(wrapDeg(a - b));
  return raw > 180 ? 360 - raw : raw;
}

// stima velocità giornaliera media (deg/giorno) per applicare applying/separating
const MEAN_SPEED: Partial<Record<PlanetName | 'ASC' | 'MC', number>> = {
  Sun: 0.9856, Moon: 13.176, Mercury: 1.2, Venus: 1.2, Mars: 0.5,
  Jupiter: 0.083, Saturn: 0.033, Uranus: 0.012, Neptune: 0.006, Pluto: 0.004,
  ASC: 0, MC: 0,
};
function isApplying(a: ChartPoint, b: ChartPoint, aspectExact: number): boolean {
  // prende il "più veloce" come riferimento
  const va = MEAN_SPEED[a.name as PlanetName] ?? 0;
  const vb = MEAN_SPEED[b.name as PlanetName] ?? 0;
  const fast = va >= vb ? a : b;
  // Se il veloce è "prima" dell'esatto muovendosi in avanti → applying
  // target = long dell'altro +/- aspectExact (quello più vicino)
  const target1 = wrapDeg((b.lon + aspectExact));
  const target2 = wrapDeg((b.lon - aspectExact));
  const d1 = minAngle(fast.lon, target1);
  const d2 = minAngle(fast.lon, target2);
  const target = d1 <= d2 ? target1 : target2;
  const delta = wrapDeg(target - fast.lon); // quanto manca muovendosi avanti
  return delta < 180; // se "davanti" nel senso diretto → applica
}

function aspectWeight(a: AspectName): number {
  switch (a) {
    case 'conjunction': return 1.00;
    case 'opposition':  return 0.95;
    case 'trine':       return 0.90;
    case 'square':      return 0.85;
    case 'sextile':     return 0.78;
    case 'quincunx':    return 0.55;
    case 'semi-sextile':return 0.50;
  }
}
function pointWeight(p: ChartPoint['name']): number {
  switch (classOf(p)) {
    case 'lum': return 1.00;
    case 'ang': return 0.95;
    case 'pers': return 0.90;
    case 'soc': return 0.80;
    case 'out': return 0.70;
  }
}

export type ComputeOpts = {
  includeMinor?: boolean;
  topN?: number;
};

export function computeSynastryAspects(
  userPoints: ChartPoint[],
  personPoints: ChartPoint[],
  opts: ComputeOpts = {}
): SynastryAspect[] {
  const aspects: AspectName[] = opts.includeMinor
    ? ['conjunction','semi-sextile','sextile','square','trine','quincunx','opposition']
    : ['conjunction','sextile','square','trine','opposition'];

  const res: SynastryAspect[] = [];
  for (const ua of userPoints) {
    for (const pb of personPoints) {
      const d = minAngle(ua.lon, pb.lon);

      // individua l'aspetto più vicino
      let best: { a: AspectName; exact: number; diff: number } | null = null;
      for (const a of aspects) {
        const exact = ASPECT_DEG[a];
        const diff = Math.abs(d - exact);
        if (!best || diff < best.diff) best = { a, exact, diff };
      }
      if (!best) continue;

      const orbMax = maxOrb(ua.name, pb.name, best.a);
      if (best.diff <= orbMax) {
        const applying = isApplying(ua, pb, best.exact);
        const score =
          aspectWeight(best.a) * pointWeight(ua.name) * pointWeight(pb.name) * (1 - best.diff / orbMax);

        res.push({
          a: { owner: 'user', name: ua.name, lon: ua.lon },
          b: { owner: 'person', name: pb.name, lon: pb.lon },
          aspect: best.a,
          exact: best.exact,
          orb: Number(best.diff.toFixed(2)),
          applying,
          score: Number(score.toFixed(3)),
        });
      }
    }
  }

  res.sort((A, B) => (B.score - A.score) || (A.orb - B.orb));
  return typeof opts.topN === 'number' ? res.slice(0, opts.topN) : res;
}

// Helper per chatbot: stringa sintetica
export function formatSynastryContext(rows: SynastryAspect[], top = 10): string {
  const lines = (rows.slice(0, top)).map(r =>
    `${r.a.name}(${r.a.owner[0]}) ${r.aspect} ${r.b.name}(${r.b.owner[0]}) orb ${r.orb}° score ${r.score}`
  );
  return lines.length ? `CONTEXT_SYNASTRY\n${lines.join('\n')}` : '';
}
