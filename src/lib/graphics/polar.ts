// src/lib/graphics/polar.ts
/**
 * Utility matematiche e layout polari per le ruote astrologiche Pro.
 * Pure funzioni senza dipendenze esterne.
 */

export interface XY {
  x: number;
  y: number;
}

/** Converte gradi in radianti */
export function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Converte radianti in gradi (0..360) */
export function rad2deg(rad: number): number {
  const d = (rad * 180) / Math.PI;
  return ((d % 360) + 360) % 360;
}

/** Normalizza un angolo in gradi a [0,360) */
export function wrapDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Coordinate XY da centro (cx,cy), raggio r e angolo in gradi */
export function polarToXY(cx: number, cy: number, r: number, angleDeg: number): XY {
  const a = deg2rad(angleDeg - 90); // 0° = verticale in alto
  return {
    x: cx + r * Math.cos(a),
    y: cy + r * Math.sin(a),
  };
}

/** Costruisce un arco SVG tra due angoli (in gradi) */
export function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = polarToXY(cx, cy, r, endDeg);
  const end = polarToXY(cx, cy, r, startDeg);
  const largeArcFlag = endDeg - startDeg <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

/**
 * Collision avoidance semplice:
 * - riceve una lista di angoli target (deg)
 * - restituisce gli angoli aggiustati con spaziatura minima
 */
export function resolveCollisions(
  anglesDeg: number[],
  minSepDeg = 8
): number[] {
  if (anglesDeg.length < 2) return anglesDeg;

  const sorted = [...anglesDeg].sort((a, b) => a - b);
  const adjusted = [...sorted];

  for (let i = 1; i < adjusted.length; i++) {
    if (adjusted[i] - adjusted[i - 1] < minSepDeg) {
      adjusted[i] = adjusted[i - 1] + minSepDeg;
    }
  }

  // wrap finale a 0..360
  return adjusted.map(wrapDeg);
}

/**
 * Leader line (dal punto interno a etichetta esterna)
 */
export function leaderLine(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  angleDeg: number
): string {
  const p1 = polarToXY(cx, cy, innerR, angleDeg);
  const p2 = polarToXY(cx, cy, outerR, angleDeg);
  return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
}

/** Esempio d'uso (commentato):
 *
 * const center = { x: 260, y: 260 };
 * const pt = polarToXY(center.x, center.y, 200, 120); // coordinate
 * const arc = describeArc(center.x, center.y, 250, 0, 30); // settore segno
 * const noOverlap = resolveCollisions([10, 12, 15]); // => [10, 18, 26]
 */
