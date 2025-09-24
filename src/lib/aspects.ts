// FILE: src/lib/aspects.ts
import { z } from "zod";

export type PointName =
  | "Sun" | "Moon" | "Mercury" | "Venus" | "Mars"
  | "Jupiter" | "Saturn" | "Uranus" | "Neptune" | "Pluto"
  | "Asc" | "Mc" | "NNode" | "SNode";

export type AspectKey = "conj" | "sext" | "sq" | "tri" | "opp";
export type Aspect = { key: AspectKey; deg: number; label: string };

export const ASPECTS: Record<AspectKey, Aspect> = {
  conj: { key: "conj", deg: 0, label: "Conjunction" },
  sext: { key: "sext", deg: 60, label: "Sextile" },
  sq:   { key: "sq",   deg: 90, label: "Square" },
  tri:  { key: "tri",  deg: 120, label: "Trine" },
  opp:  { key: "opp",  deg: 180, label: "Opposition" },
};

const BASE_ORB: Record<AspectKey, number> = {
  conj: 8, sext: 4, sq: 6, tri: 6, opp: 8,
};

function isLuminary(p: PointName): boolean {
  return p === "Sun" || p === "Moon";
}

export function maxOrbForPair(a: PointName, b: PointName, aspect: AspectKey): number {
  const lumBonus = (isLuminary(a) || isLuminary(b)) ? 2 : 0;
  const anglePenalty = (a === "Asc" || a === "Mc" || b === "Asc" || b === "Mc") ? -1 : 0;
  return Math.max(1, BASE_ORB[aspect] + lumBonus + anglePenalty);
}

export function acuteDelta(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

export type AspectHit = { aspect: Aspect; orb: number; ok: boolean };

export function closestAspectDelta(delta: number): AspectHit {
  let best: AspectHit = { aspect: ASPECTS.conj, orb: Math.abs(delta - 0), ok: false };
  for (const a of Object.values(ASPECTS)) {
    const orb = Math.abs(delta - a.deg);
    if (orb < best.orb) best = { aspect: a, orb, ok: false };
  }
  return best;
}

export const PointSchema = z.object({
  name: z.string(),
  longitude: z.number().min(0).max(360),
  retro: z.boolean().optional(),
});
export type Point = z.infer<typeof PointSchema>;
