// src/lib/transits/adjacency.ts
/* Pure helpers per aspetti/hover. Nessuna dipendenza dal DB. */

export type AspectType = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';

export interface AspectEdge {
  id: string;        // es: "t:Uranus__n:Sun__trine"
  aId: string;       // es: "t:Uranus"
  bId: string;       // es: "n:Sun"
  type: AspectType;
  orbDeg: number;    // valore assoluto (>= 0)
}

export interface Adjacency {
  P: Map<string, Set<string>>;         // planetId -> set(planetId collegati)
  E: Map<string, [string, string]>;    // edgeId   -> [aId, bId]
}

/** Normalizza un angolo in [0,360) */
export function norm360(deg: number): number {
  let x = deg % 360;
  if (x < 0) x += 360;
  return x;
}

/** Distanza angolare minima in [0,180] tra due direzioni in gradi */
export function angularSeparation(a: number, b: number): number {
  const d = Math.abs(norm360(a) - norm360(b)) % 360;
  return d > 180 ? 360 - d : d;
}

/** Restituisce l'angolo teorico dell'aspetto (0, 60, 90, 120, 180) */
export function aspectExactAngle(t: AspectType): number {
  switch (t) {
    case 'conjunction': return 0;
    case 'sextile':     return 60;
    case 'square':      return 90;
    case 'trine':       return 120;
    case 'opposition':  return 180;
  }
}

/** true se la separazione è entro l'orb (inclusivo) rispetto al target dell'aspetto */
export function isAspectMatch(sepDeg: number, type: AspectType, maxOrbDeg: number): boolean {
  const target = aspectExactAngle(type);
  const diff = Math.abs(sepDeg - target);
  return diff <= maxOrbDeg;
}

/** Crea la mappa di adiacenza per highlight veloci e deterministici */
export function buildAdjacencyMap(aspects: AspectEdge[]): Adjacency {
  const P = new Map<string, Set<string>>();
  const E = new Map<string, [string, string]>();
  for (const x of aspects) {
    if (!P.has(x.aId)) P.set(x.aId, new Set());
    if (!P.has(x.bId)) P.set(x.bId, new Set());
    P.get(x.aId)!.add(x.bId);
    P.get(x.bId)!.add(x.aId);
    E.set(x.id, [x.aId, x.bId]);
  }
  return { P, E };
}