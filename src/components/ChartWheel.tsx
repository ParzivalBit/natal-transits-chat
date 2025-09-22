// src/components/ChartWheel.tsx
// Wheel stile AstroDienst con case Placidus ordinate realmente in senso orario (CW)
// partendo dalla cuspide I. Numeri al midpoint dell’arco corretto.

import React, { useMemo } from 'react';

type Point = {
  name: string;
  longitude: number; // [0,360)
  sign?: string | null;
  house?: number | null;
  retro?: boolean | null;
};

type Props = {
  points: Point[];
  houseCusps?: number[];                // 12 cuspidi I..XII
  mcDeg?: number;
  orientation?: 'by-asc' | 'by-mc';     // default: by-asc (ASC a sinistra)
  direction?: 'cw' | 'ccw';             // default: 'cw' (come AstroDienst)
  size?: number;
  className?: string;
  showZodiacRing?: boolean;
  showHouseNumbers?: boolean;
};

const d2r = (d: number) => (d * Math.PI) / 180;
const norm = (x: number) => ((x % 360) + 360) % 360;

const SIGN_GLYPH = ['♈︎','♉︎','♊︎','♋︎','♌︎','♍︎','♎︎','♏︎','♐︎','♑︎','♒︎','♓︎'];
const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

const POINT_GLYPH: Record<string,string> = {
  Sun: '☉', Moon: '☾', Mercury: '☿', Venus: '♀', Mars: '♂',
  Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇',
  'True Node': '☊', 'Mean Node': '☊', Node: '☊', 'South Node': '☋',
  Chiron: '⚷'
};

/** Proiezione λ → angolo SVG applicando direzione e rotazione. */
function projectAngleDeg(lambda: number, rotation: number, direction: 'cw' | 'ccw'): number {
  // SVG: 0° a destra, angoli crescono CCW.
  // - 'cw'  : angle = rotation - λ  (zodiaco visivamente orario)
  // - 'ccw' : angle = rotation + λ
  return direction === 'cw' ? norm(rotation - lambda) : norm(rotation + lambda);
}

/** Delta muovendosi CW nello spazio schermo (angoli proiettati). */
function deltaScreenCW(aStart: number, aEnd: number): number {
  return norm(aStart - aEnd); // [0,360)
}

/** Path SVG per un arco da aStart→aEnd nel verso CW o CCW. */
function arcPathDir(
  cx: number,
  cy: number,
  r: number,
  aStartDeg: number,
  aEndDeg: number,
  dir: 'cw' | 'ccw'
): string {
  const aStart = d2r(aStartDeg);
  let delta: number, endDeg: number, sweepFlag: 0 | 1;

  if (dir === 'ccw') {
    delta = norm(aEndDeg - aStartDeg);
    endDeg = aStartDeg + delta;
    sweepFlag = 1; // CCW
  } else {
    delta = norm(aStartDeg - aEndDeg);
    endDeg = aStartDeg - delta;
    sweepFlag = 0; // CW
  }

  const aEnd = d2r(norm(endDeg));
  const x1 = cx + Math.cos(aStart) * r;
  const y1 = cy + Math.sin(aStart) * r;
  const x2 = cx + Math.cos(aEnd) * r;
  const y2 = cy + Math.sin(aEnd) * r;
  const largeArc = delta > 180 ? 1 : 0;

  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${x2} ${y2}`;
}

export default function ChartWheel({
  points,
  houseCusps,
  mcDeg,
  orientation = 'by-asc',
  direction = 'cw',
  size = 560,
  className,
  showZodiacRing = true,
  showHouseNumbers = true
}: Props) {
  const r = size / 2;
  const cx = r, cy = r;

  // Layer radii (rays fino al cerchio più interno, per spicchi netti)
  const R_OUTER = r - 8;
  const R_ZOD_OUT = r - 30;
  const R_ZOD_IN  = r - 64;
  const R_PLANETS = r - 108;
  const R_HOUSE_ARC = r - 146;
  const R_HOUSE_NUM = r - 168;
  const R_HOUSE_RAY = r - 200;
  const R_INNER = r - 200;

  const cusps = Array.isArray(houseCusps) && houseCusps.length === 12 ? houseCusps.map(norm) : null;
  const mcFromPoints = useMemo(() => points.find(p => p.name === 'MC')?.longitude ?? 0, [points]);
  const mc = typeof mcDeg === 'number' ? mcDeg : mcFromPoints;

  // Rotazione globale (ASC a sinistra, oppure MC in alto)
  const rotation = useMemo(() => {
    const dirSign = direction === 'cw' ? -1 : +1;
    if (orientation === 'by-asc' && cusps) return norm(180 - dirSign * cusps[0]);
    if (orientation === 'by-mc')          return norm( 90 - dirSign * norm(mc));
    return norm(90);
  }, [orientation, direction, cusps, mc]);

  // Anelli base
  const base = (
    <>
      <circle cx={cx} cy={cy} r={R_OUTER} fill="none" stroke="currentColor" strokeOpacity={0.25}/>
      <circle cx={cx} cy={cy} r={R_ZOD_OUT} fill="none" stroke="currentColor" strokeOpacity={0.2}/>
      <circle cx={cx} cy={cy} r={R_ZOD_IN}  fill="none" stroke="currentColor" strokeOpacity={0.2}/>
      <circle cx={cx} cy={cy} r={R_INNER}   fill="none" stroke="currentColor" strokeOpacity={0.25}/>
    </>
  );

  // Zodiaco
  const zodiac = showZodiacRing ? (
    <>
      {Array.from({ length: 12 }, (_, i) => {
        const deg = i * 30;
        const A = d2r(projectAngleDeg(deg, rotation, direction));
        const x1 = cx + Math.cos(A) * R_ZOD_OUT;
        const y1 = cy + Math.sin(A) * R_ZOD_OUT;
        const x2 = cx + Math.cos(A) * R_ZOD_IN;
        const y2 = cy + Math.sin(A) * R_ZOD_IN;
        return <line key={`z-split-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeOpacity={0.35}/>;
      })}
      {Array.from({ length: 12 }, (_, i) => {
        const mid = i * 30 + 15;
        const A = d2r(projectAngleDeg(mid, rotation, direction));
        const lx = cx + Math.cos(A) * ((R_ZOD_OUT + R_ZOD_IN) / 2);
        const ly = cy + Math.sin(A) * ((R_ZOD_OUT + R_ZOD_IN) / 2);
        return (
          <text
            key={`z-glyph-${i}`}
            x={lx} y={ly}
            textAnchor="middle" dominantBaseline="central"
            fontSize={14} fill="currentColor" opacity={0.9}
            aria-label={SIGN_NAMES[i]}
          >
            {SIGN_GLYPH[i]}
          </text>
        );
      })}
    </>
  ) : null;

  // --- CASE ---

  // Raggi sulle cuspidi, fino al cerchio interno
  const houseRays = cusps?.map((deg, i) => {
    const A = d2r(projectAngleDeg(deg, rotation, direction));
    const x1 = cx + Math.cos(A) * R_ZOD_IN;
    const y1 = cy + Math.sin(A) * R_ZOD_IN;
    const x2 = cx + Math.cos(A) * R_HOUSE_RAY;
    const y2 = cy + Math.sin(A) * R_HOUSE_RAY;
    const thick = (i === 0 || i === 9) ? 2 : 1;
    return <line key={`h-ray-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={thick} />;
  }) ?? null;

  let houseArcs: JSX.Element[] | null = null;
  let houseNums: JSX.Element[] | null = null;

  if (cusps) {
    // Angoli proiettati delle 12 cuspidi
    const A: number[] = cusps.map(c => projectAngleDeg(c, rotation, direction));
    const N = 12;

    // Per ogni cuspide i, trova l'indice j della SUCCESSIVA adiacente in CW
    const nextCW: number[] = new Array(N).fill(0);
    for (let i = 0; i < N; i++) {
      let best = 360, bestJ = i;
      for (let k = 0; k < N; k++) {
        if (k === i) continue;
        const d = deltaScreenCW(A[i], A[k]);
        if (d > 0 && d < best) { best = d; bestJ = k; }
      }
      nextCW[i] = bestJ;
    }

    // Cammina davvero da cuspide I (indice 0) seguendo nextCW in CW → ordine geometrico
    const order: number[] = [];
    const seen = new Array(N).fill(false);
    let cur = 0;
    for (let step = 0; step < N; step++) {
      order.push(cur);
      seen[cur] = true;
      const nxt = nextCW[cur];
      if (seen[nxt]) {
        // (degenere) se chiude un ciclo prima di 12, riempi con gli indici mancanti ordinati per angolo CW
        if (order.length < N) {
          const rest = [...Array(N).keys()].filter(ix => !seen[ix]);
          // ordina i rimanenti in senso CW rispetto all’ultimo angolo
          rest.sort((i, j) => deltaScreenCW(A[cur], A[i]) - deltaScreenCW(A[cur], A[j]));
          order.push(...rest);
        }
        break;
      }
      cur = nxt;
    }
    if (order.length < N) {
      // fallback di sicurezza (non dovrebbe servire)
      const idx = [...Array(N).keys()];
      idx.sort((i, j) => deltaScreenCW(A[0], A[i]) - deltaScreenCW(A[0], A[j]));
      for (const k of idx) if (!order.includes(k)) order.push(k);
    }

    // Disegna archi Casa j: order[j] → order[j+1] (CW) e numero al midpoint di quell’arco
    houseArcs = order.map((idx, j) => {
      const start = A[idx];
      const end   = A[order[(j + 1) % N]];
      const path  = arcPathDir(cx, cy, R_HOUSE_ARC, start, end, 'cw');
      return (
        <path
          key={`h-arc-${j}`}
          d={path}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.28}
        />
      );
    });

    if (showHouseNumbers) {
      houseNums = order.map((idx, j) => {
        const start = A[idx];
        const end   = A[order[(j + 1) % N]];
        const delta = norm(start - end); // CW
        const midDeg = norm(start - delta / 2);
        const mid = d2r(midDeg);
        const lx = cx + Math.cos(mid) * R_HOUSE_NUM;
        const ly = cy + Math.sin(mid) * R_HOUSE_NUM;
        return (
          <text
            key={`h-num-${j}`}
            x={lx} y={ly}
            textAnchor="middle" dominantBaseline="central"
            fontSize={12} fill="currentColor" opacity={0.9}
          >
            {j + 1}
          </text>
        );
      });
    }
  }

  // Angoli (etichette sulle loro cuspidi)
  const angleLabels = cusps ? (() => {
    const idx = { AC: 0, MC: 9, DC: 6, IC: 3 }; // I, X, VII, IV
    return (Object.entries(idx) as Array<[keyof typeof idx, number]>).map(([label, i]) => {
      const A = d2r(projectAngleDeg(cusps[i], rotation, direction));
      const lx = cx + Math.cos(A) * (R_ZOD_OUT + 8);
      const ly = cy + Math.sin(A) * (R_ZOD_OUT + 8);
      return (
        <text key={`ang-${label}`} x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontSize={12}>
          {label}
        </text>
      );
    });
  })() : null;

  // Pianeti (senza angoli): tacchetta blu verso zodiaco
  const planetDots = points
    .filter(p => p.name !== 'ASC' && p.name !== 'MC' && p.name !== 'IC' && p.name !== 'DSC')
    .map((p) => {
      const lam = norm(p.longitude);
      const A = d2r(projectAngleDeg(lam, rotation, direction));
      const x = cx + Math.cos(A) * R_PLANETS;
      const y = cy + Math.sin(A) * R_PLANETS;

      const tx1 = cx + Math.cos(A) * (R_ZOD_IN + 4);
      const ty1 = cy + Math.sin(A) * (R_ZOD_IN + 4);
      const tx2 = cx + Math.cos(A) * (R_ZOD_IN + 12);
      const ty2 = cy + Math.sin(A) * (R_ZOD_IN + 12);

      const glyph = POINT_GLYPH[p.name] ?? p.name.slice(0, 1).toUpperCase();

      return (
        <g key={`pt-${p.name}-${lam.toFixed(2)}`}>
          <line x1={tx1} y1={ty1} x2={tx2} y2={ty2} stroke="#3b82f6" strokeWidth={1}/>
          <circle cx={x} cy={y} r={3} fill="currentColor" />
          <text
            x={x} y={y}
            dx={8} dy={-4}
            fontSize={11}
            textAnchor="start" dominantBaseline="central"
            fill="currentColor"
          >
            {glyph}{p.retro ? ' ℞' : ''}
          </text>
        </g>
      );
    });

  return (
    <svg width={size} height={size} className={className} role="img" aria-label="Astrology Chart Wheel">
      {base}
      {zodiac}
      {/* Case: archi (ampiezza), raggi (cuspidi) e numeri (midpoint CW in ordine 1..12) */}
      {houseArcs}
      {houseRays}
      {houseNums}
      {planetDots}
      {angleLabels}
    </svg>
  );
}
