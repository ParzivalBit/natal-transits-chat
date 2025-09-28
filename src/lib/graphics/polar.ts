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

/**
 * Conversione unica per coordinate/polari SVG:
 *  - 0° punta in alto (ore 12)
 *  - angoli crescono in senso orario
 *  => θ_svg = deg - 90
 */
function toSvgRad(angleDeg: number): number {
  return deg2rad(angleDeg - 90);
}

/** Coordinate XY da centro (cx,cy), raggio r e angolo in gradi */
export function polarToXY(cx: number, cy: number, r: number, angleDeg: number): XY {
  const a = toSvgRad(angleDeg);
  return {
    x: cx + r * Math.cos(a),
    y: cy + r * Math.sin(a),
  };
}

/**
 * Costruisce un arco SVG tra due angoli (in gradi).
 * Usa la stessa convenzione angolare di polarToXY.
 * Il path viene tracciato in senso orario se endDeg > startDeg (mod 360).
 */
export function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = polarToXY(cx, cy, r, startDeg);
  const end = polarToXY(cx, cy, r, endDeg);

  // ampiezza (in [0,360))
  const sweep = wrapDeg(endDeg - startDeg);
  const largeArcFlag = sweep > 180 ? 1 : 0;

  // sweep-flag: 1 = orario (coerente con la nostra convenzione)
  const sweepFlag = 1;

  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`;
}

/**
 * Collision avoidance semplice:
 * - riceve una lista di angoli target (deg)
 * - restituisce gli angoli aggiustati con spaziatura minima,
 *   **preservando l'ordine originale** dell'input.
 * - gestisce anche il wrap-around 360°.
 */
export function resolveCollisions(anglesDeg: number[], minSepDeg = 8): number[] {
  const n = anglesDeg.length;
  if (n < 2) return anglesDeg.slice();

  // 1) normalizza e aggancia indici originali
  const items = anglesDeg.map((a, idx) => ({ idx, a: wrapDeg(a) }));

  // 2) ordina per angolo
  items.sort((u, v) => u.a - v.a);

  // 3) separazione progressiva in avanti
  for (let i = 1; i < n; i++) {
    if (items[i].a - items[i - 1].a < minSepDeg) {
      items[i].a = items[i - 1].a + minSepDeg;
    }
  }

  // 4) gestisci il gap tra l’ultimo e il primo (wrap 360°)
  const gap = (items[0].a + 360) - items[n - 1].a;
  if (gap < minSepDeg) {
    // spingi in giù il primo sotto 0, poi normalizza
    items[0].a = items[n - 1].a + minSepDeg - 360;
    // e riallinea in avanti se necessario
    for (let i = 1; i < n; i++) {
      if (items[i].a - items[i - 1].a < minSepDeg) {
        items[i].a = items[i - 1].a + minSepDeg;
      }
    }
  }

  // 5) rimappa all’ordine d’ingresso
  const out = new Array<number>(n);
  for (const it of items) out[it.idx] = wrapDeg(it.a);
  return out;
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
 * const noOverlap = resolveCollisions([10, 12, 15]); // => [10, 18, 26] (stesso ordine input)
 */
