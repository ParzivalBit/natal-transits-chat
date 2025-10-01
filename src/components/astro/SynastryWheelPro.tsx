'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { polarToXY } from '@/lib/graphics/polar';
import {
  planetChar,
  signChar,
  signColor,
  aspectColor,
  type PlanetName,
  type ZodiacSign,
} from '@/lib/graphics/glyphs';

// new utilities
import { getProRadii } from '@/components/astro/proLayout';
import { radialStagger } from '@/components/astro/labeling';

// ---------- Tipi ----------
export type PlanetNameStrict =
  | 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars'
  | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune' | 'Pluto';
export type AngleName = 'ASC' | 'MC';
export type PlanetOrAngle = PlanetNameStrict | AngleName;

export type ChartPoint = {
  name: PlanetOrAngle;
  lon: number;           // 0..360
  retro?: boolean;
  sign?: string | null;
  house?: number | null;
};

export type SAspectType = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';
export type SAspect = {
  a: { owner: 'user' | 'person'; name: PlanetOrAngle };
  b: { owner: 'user' | 'person'; name: PlanetOrAngle };
  aspect: SAspectType;
  exact?: boolean;
  applying?: boolean;
  score?: number;
};

type Axes = { asc: number; mc: number };
type PtWithTheta = ChartPoint & { theta: number };

export type SynastryWheelProProps = {
  user:   { points: ChartPoint[]; houses?: number[]; axes?: Axes };
  person: { points: ChartPoint[]; houses?: number[]; axes?: Axes };
  aspects?: SAspect[];
  size?: number;
  responsive?: boolean;
  className?: string;
  orientation?: 'ccw' | 'cw';
  zodiacPhaseDeg?: number; // offset solo per la fascia zodiacale (default 0). Metti 180 per "ribaltarla".
  tickSize?: number; /** lunghezza delle tacche che indicano dove cade un pianeta (px) */
  userGlyphOffset?: number;   // px, positivo = verso il centro
  personGlyphOffset?: number; // px, positivo = verso il centro
  radiiOverrides?: Partial<Parameters<typeof getProRadii>[0]>; /** controllo fine dei raggi (opzionale) */
};

// ---------- Utility ----------
const norm360 = (d: number) => ((d % 360) + 360) % 360;
const pKey = (owner: 'user'|'person', name: PlanetOrAngle) => `${owner}:${name}`;
// micro-offset per centrare otticamente glifo e cerchio hover
const GLYPH_DX = 0;     // se vedi un lieve disallineamento orizzontale, regola di ±0.5
const GLYPH_DY = 0.5;   // 0.5–1px spesso basta per la Luna


// ---------- Component ----------
export default function SynastryWheelPro({
  user,
  person,
  aspects = [],
  size = 560,
  responsive = true,
  className,
  tickSize = 12,                 // <— parametrico
  radiiOverrides,
  orientation = 'ccw',
  zodiacPhaseDeg = 0,
  userGlyphOffset = 6,        // prova 6–10 px
  personGlyphOffset = 0,
}: SynastryWheelProProps) {

  // colori e grid come prima
  const COLOR_USER = '#0284c7';    // blu
  const COLOR_PERSON = '#ea580c';  // arancione
  const GRID = '#6b7280';
  const GRID_MID = '#9ca3af';
  const GRID_LIGHT = '#e5e7eb';
  const TEXT = '#111827';

  // Canvas
  const r = size / 2;
  const CX = r, CY = r;

  // Geometrie centralizzate: niente fessure (gap: 0)
  const radii = useMemo(() => getProRadii({
    R: r * 0.94,          // manteniamo proporzioni simili al tuo originale
    gap: 0,               // 0 => fasce a filo
    ringZodiac: 42,
    ringUserHouses: 43,
    ringPersonHouses: 44,
    ringAspectogram: r * 0.48, // hub aspetti
    ...radiiOverrides,
  }), [r, radiiOverrides]);

  // derivati comodi come prima
  const R_ZOD_OUT = radii.zodiac.outer;
  const R_ZOD_IN  = radii.zodiac.inner;

  const R_USER_OUT   = radii.userHouses.outer;
  const R_USER_IN    = radii.userHouses.inner;

  const R_PERSON_OUT = radii.personHouses.outer;
  const R_PERSON_IN  = radii.personHouses.inner;

  const R_ASPECT     = radii.aspectogramRadius;
  const R_CENTER     = R_ASPECT * 0.77; // simile al tuo

    // Rotazione/Orientamento globale:
  // - mettiamo l'ASC utente a sinistra (ore 9) via rot
  // - orientamento antiorario (dir = -1) o orario (dir = +1)
  const dir = orientation === 'ccw' ? -1 : 1;
  const asc0 = user.axes?.asc ?? 180;

  // IMPORTANTISSIMO: scegli rot in modo che toViewAngle(ASC) = 270° (ore 9) per QUALSIASI 'dir'
  const rot = useMemo(() => norm360(270 - dir * asc0), [asc0, dir]);

  const toViewAngle = useCallback((deg: number) => {
    return norm360(rot + dir * deg);
  }, [rot, dir]);

  // Per la sola fascia zodiacale puoi voler applicare una micro-fase opzionale
  const toZodiacAngle = useCallback((deg: number) => {
    return toViewAngle(deg + zodiacPhaseDeg);
  }, [toViewAngle, zodiacPhaseDeg]);


  // Pianeti con theta ruotato
  const userPts = useMemo<PtWithTheta[]>(
    () => user.points.map(p => ({ ...p, theta: toViewAngle(norm360(p.lon)) })),
    [user.points, toViewAngle]
  );
  const personPts = useMemo<PtWithTheta[]>(
    () => person.points.map(p => ({ ...p, theta: toViewAngle(norm360(p.lon)) })),
    [person.points, toViewAngle]
  );

  // Hover state
    const [hover, setHover] = useState<{ kind:'planet'|'aspect'; key: string } | null>(null);
  // quando si passa su una linea di aspetto, evidenzia i due pianeti coinvolti
  const highlightedByAspect = useMemo<Set<string>>(() => {
    if (!hover || hover.kind !== 'aspect') return new Set();
    const idx = Number(hover.key);
    const a = aspects?.[idx];
    if (!a) return new Set();
    return new Set([ pKey(a.a.owner, a.a.name), pKey(a.b.owner, a.b.name) ]);
  }, [hover, aspects]);

    const highlightedByPlanet = useMemo<Set<string>>(() => {
    if (!hover || hover.kind !== 'planet') return new Set();
    const k = hover.key; // es. "user:Sun"
    const set = new Set<string>([k]); // sempre illuminiamo anche il pianeta stesso
    for (const a of (aspects ?? [])) {
      const aKey = pKey(a.a.owner, a.a.name);
      const bKey = pKey(a.b.owner, a.b.name);
      if (aKey === k) set.add(bKey);
      if (bKey === k) set.add(aKey);
    }
    return set;
  }, [hover, aspects]);

  // Unione dei due set: se sono su una linea oppure su un pianeta
  const highlighted = useMemo(() => {
    const s = new Set<string>(highlightedByAspect);
    for (const k of highlightedByPlanet) s.add(k);
    return s;
  }, [highlightedByAspect, highlightedByPlanet]);


  // ---------- Labeling anti-overlap (radial staggering) ----------
  const userDisp = useMemo(() => {
    // baseR: centro dell'anello user
    const baseR = (R_USER_OUT + R_USER_IN) / 2  - userGlyphOffset;  // <-- offset
    return radialStagger(
      userPts.map(p => ({ name: p.name, lon: p.theta, baseR })), // NB: lon = theta (ruotato)
      2.0,  // min distanza angolare (°) per salire di livello
      8,    // incremento raggio per livello
      3     // max livelli
    );
  }, [R_USER_OUT, R_USER_IN, userGlyphOffset, userPts]);

  const personDisp = useMemo(() => {
    const baseR = (R_PERSON_OUT + R_PERSON_IN) / 2  - personGlyphOffset;  // <-- offset
    return radialStagger(
      personPts.map(p => ({ name: p.name, lon: p.theta, baseR })),
      2.7, 8, 5
    );
  }, [R_PERSON_OUT, R_PERSON_IN, personGlyphOffset, personPts]);

  // ---------- Render helpers ----------
  const SignGlyph = ({ sign, sizePx }: { sign: ZodiacSign; sizePx: number }) => (
    <text
      x={0} y={0} fontSize={sizePx}
      textAnchor="middle" dominantBaseline="middle"
      fill={signColor(sign)}
      fontFamily='"Noto Sans Symbols 2","Segoe UI Symbol","Apple Symbols","DejaVu Sans",sans-serif'
    >
      {signChar(sign)}
    </text>
  );

  function drawZodiac() {
    const nodes: React.ReactNode[] = [];
    for (let i = 0; i < 12; i++) {
      const sign = ([
        'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
        'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces',
      ] as ZodiacSign[])[i]!;

      const start = toZodiacAngle(i * 30);
      const mid   = toZodiacAngle(i * 30 + 15);
      const t1 = polarToXY(CX, CY, R_ZOD_OUT, start);
      const t2 = polarToXY(CX, CY, R_ZOD_IN,  start);
      const g  = polarToXY(CX, CY, (R_ZOD_OUT + R_ZOD_IN) / 2, mid);

      nodes.push(
        <g key={`z-${i}`}>
          <line x1={t1.x} y1={t1.y} x2={t2.x} y2={t2.y} stroke={GRID} strokeOpacity={0.45} strokeWidth={1}/>
          <g transform={`translate(${g.x},${g.y})`}>
            <SignGlyph sign={sign} sizePx={16} />
          </g>
        </g>
      );
    }
    return (
      <g>
        <circle cx={CX} cy={CY} r={R_ZOD_OUT} fill="none" stroke={TEXT} strokeOpacity={0.65} strokeWidth={2}/>
        <circle cx={CX} cy={CY} r={R_ZOD_IN}  fill="none" stroke={GRID} strokeOpacity={0.5}/>
        {nodes}
      </g>
    );
  }


  function drawHouseBand(cusps: number[] | undefined, color: string, rOuter: number, rInner: number, putNumbersInside: boolean) {
    if (!cusps || cusps.length !== 12) return null;

    const ticks: React.ReactNode[] = [];
    const labels: React.ReactNode[] = [];
    const rMid = (rOuter + rInner) / 2;

    for (let i = 0; i < 12; i++) {
      const v = cusps[i]!;
      const next = cusps[(i + 1) % 12]!;
      const a = toViewAngle(v);
      const pOut = polarToXY(CX, CY, rOuter, a);
      const pIn  = polarToXY(CX, CY, rInner, a);

      ticks.push(
        <line key={`tick-${color}-${i}`} x1={pOut.x} y1={pOut.y} x2={pIn.x} y2={pIn.y} stroke={color} strokeWidth={1.35} strokeOpacity={0.95} />
      );

      const arc = (next - v + 360) % 360;
      const mid = toViewAngle(v + arc / 2);
      const labelR = putNumbersInside ? rMid - 10 : rMid + 10;
      const lp = polarToXY(CX, CY, labelR, mid);
      labels.push(
        <text key={`h-${color}-${i}`} x={lp.x} y={lp.y} fontSize={10} textAnchor="middle" dominantBaseline="middle" fill={color} opacity={0.95}>
          {i + 1}
        </text>
      );
    }

    return (
      <g>
        {/* bordi a filo: nessun offset oltre rOuter/rInner */}
        <circle cx={CX} cy={CY} r={rOuter} fill="none" stroke={GRID_MID} />
        <circle cx={CX} cy={CY} r={rInner} fill="none" stroke={GRID_MID} />
        {ticks}
        {labels}
      </g>
    );
  }

  function drawAxes(ax: Axes | undefined, color: string, opts?: {
    showOpposites?: boolean;
    flipMC?: boolean;         // se vuoi davvero forzare il MC "in alto", lascialo opzionale
    tickOuterPad?: number;
    tickInnerPad?: number;
    labelPad?: number;
  }) {
    if (!ax) return null;
    const {
      showOpposites = true,
      flipMC = false,           // <— DEFAULT: NIENTE FLIP (evita inversione di segni)
      tickOuterPad = 6,
      tickInnerPad = 6,
      labelPad = 12,
    } = opts ?? {};

    // Angoli geometrici (niente aggiustamenti sui segni)
    const ascRaw = ax.asc;
    const mcRaw  = flipMC ? ax.mc + 180 : ax.mc;  // se proprio vuoi forzare MC "in alto", usa flipMC=true
    const dcRaw  = ascRaw + 180;
    const icRaw  = mcRaw + 180;

    // Proiezione
    const asc = toViewAngle(ascRaw);
    const mc  = toViewAngle(mcRaw);
    const dc  = toViewAngle(dcRaw);
    const ic  = toViewAngle(icRaw);

    // Segmenti (stesso schema di prima)
    const A1 = polarToXY(CX, CY, R_ZOD_OUT + tickOuterPad, asc);
    const A2 = polarToXY(CX, CY, R_ZOD_IN  - tickInnerPad, asc);

    const M1 = polarToXY(CX, CY, R_ZOD_OUT + tickOuterPad, mc);
    const M2 = polarToXY(CX, CY, R_ZOD_IN  - tickInnerPad, mc);

    const D1 = polarToXY(CX, CY, R_ZOD_OUT + tickOuterPad, dc);
    const D2 = polarToXY(CX, CY, R_ZOD_IN  - tickInnerPad, dc);

    const I1 = polarToXY(CX, CY, R_ZOD_OUT + tickOuterPad, ic);
    const I2 = polarToXY(CX, CY, R_ZOD_IN  - tickInnerPad, ic);

    // Label positions
    const AcLab = polarToXY(CX, CY, R_ZOD_OUT + labelPad, asc);
    const McLab = polarToXY(CX, CY, R_ZOD_OUT + labelPad, mc);
    const DcLab = polarToXY(CX, CY, R_ZOD_OUT + labelPad, dc);
    const IcLab = polarToXY(CX, CY, R_ZOD_OUT + labelPad, ic);

    return (
      <g>
        {/* AC / MC */}
        <line x1={A1.x} y1={A1.y} x2={A2.x} y2={A2.y} stroke={color} strokeWidth={1.2} />
        <line x1={M1.x} y1={M1.y} x2={M2.x} y2={M2.y} stroke={color} strokeWidth={1.2} />
        <text x={AcLab.x} y={AcLab.y} fontSize={11} fill={color} textAnchor="middle" dominantBaseline="middle" style={{ fontWeight: 600 }}>AC</text>
        <text x={McLab.x} y={McLab.y} fontSize={11} fill={color} textAnchor="middle" dominantBaseline="middle" style={{ fontWeight: 600 }}>MC</text>

        {/* DC / IC (opposti) */}
        {showOpposites && (
          <>
            <line x1={D1.x} y1={D1.y} x2={D2.x} y2={D2.y} stroke={color} strokeOpacity={0.7} strokeWidth={1.1} />
            <line x1={I1.x} y1={I1.y} x2={I2.x} y2={I2.y} stroke={color} strokeOpacity={0.7} strokeWidth={1.1} />
            <text x={DcLab.x} y={DcLab.y} fontSize={10} fill={color} opacity={0.85} textAnchor="middle" dominantBaseline="middle" style={{ fontVariant: 'small-caps' }}>DC</text>
            <text x={IcLab.x} y={IcLab.y} fontSize={10} fill={color} opacity={0.85} textAnchor="middle" dominantBaseline="middle" style={{ fontVariant: 'small-caps' }}>IC</text>
          </>
        )}
      </g>
    );
  }


  // Tacche dei pianeti: ora parametrizzate da tickSize
function drawPlanetTicksLabeled(
  pts: PtWithTheta[],              // deve contenere name + theta
  owner: 'user' | 'person',
  color: string,
  hiSet: Set<string>,              // set di chiavi evidenziate es. "user:Sun"
  baseTick = tickSize              // usa la prop già introdotta
) {
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const key = `${owner}:${p.name}`;
    const th  = p.theta;
    const a   = polarToXY(CX, CY, R_ZOD_IN, th);
    const len = hiSet.has(key) ? baseTick + 4 : baseTick; // tacca più lunga se evidenziata
    const w   = hiSet.has(key) ? 2 : 1;                   // e più spessa
    const b   = polarToXY(CX, CY, R_ZOD_IN - len, th);
    nodes.push(
      <line
        key={`pt-${owner}-${i}`}
        x1={a.x} y1={a.y} x2={b.x} y2={b.y}
        stroke={color}
        strokeWidth={w}
        strokeOpacity={hiSet.has(key) ? 0.95 : 0.55}
      />
    );
  }
  return <g>{nodes}</g>;
}


  // Disegna glifi usando il raggio “staggered” ma lascia le tacche al raggio base
  function drawPlanets(
    disp: ReturnType<typeof radialStagger>,
    color: string,
    owner: 'user' | 'person',
    hiSet: Set<string>
  ) {
    return (
      <g>
        {disp.map((p) => {
          const pos = polarToXY(CX, CY, p.r, p.lon);
          const key = `${owner}:${p.name}`;
          const isActive =
            (hover?.kind === 'planet' && hover.key === key) || // pianeta sotto il mouse
            hiSet.has(key);                                     // pianeti collegati
          return (
            <g key={key}
              transform={`translate(${pos.x},${pos.y})`}
              onMouseEnter={() => setHover({ kind:'planet', key })}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'pointer' }}>
              {isActive && <circle cx={GLYPH_DX} cy={GLYPH_DY} r={12} fill="none" stroke={color} strokeWidth={1.5} />}
              <text x={GLYPH_DX}
                y={GLYPH_DY}
                fontSize={16}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={color}
                fontFamily='"Noto Sans Symbols 2","Segoe UI Symbol","Apple Symbols","DejaVu Sans",sans-serif'
                aria-label={p.name}>{planetChar(p.name as PlanetName)}</text>
            </g>
          );
        })}
      </g>
    );
  }



  function drawAspects(list: SAspect[]) {
    if (!list || list.length === 0) return null;

    // Mappa nome -> theta per lookup veloce (usiamo i pts originali con theta)
    const mapUser = new Map<PlanetOrAngle, number>(userPts.map(p => [p.name, p.theta]));
    const mapPerson = new Map<PlanetOrAngle, number>(personPts.map(p => [p.name, p.theta]));

    return (
      <g>
        <circle cx={CX} cy={CY} r={R_ASPECT} fill="none" stroke={GRID_MID} />
        <circle cx={CX} cy={CY} r={R_CENTER} fill="none" stroke={GRID_LIGHT} />
        {list.map((a, idx) => {
          const thA = (a.a.owner === 'user' ? mapUser.get(a.a.name) : mapPerson.get(a.a.name));
          const thB = (a.b.owner === 'user' ? mapUser.get(a.b.name) : mapPerson.get(a.b.name));
          if (thA == null || thB == null) return null;
          const A = polarToXY(CX, CY, R_ASPECT, thA);
          const B = polarToXY(CX, CY, R_ASPECT, thB);
          const c = aspectColor(a.aspect);
          const isHi = (hover?.kind === 'aspect' && hover.key === `${idx}`) ||
                       (hover?.kind === 'planet' && (
                         hover.key === `${a.a.owner}:${a.a.name}` || hover.key === `${a.b.owner}:${a.b.name}`
                       ));
          return (
            <g key={idx}
               onMouseEnter={() => setHover({ kind:'aspect', key: String(idx) })}
               onMouseLeave={() => setHover(null)}
               style={{ cursor:'pointer' }}>
              <line x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                    stroke={c} strokeWidth={isHi ? 1.6 : 1}
                    strokeOpacity={isHi ? 1 : 0.75}/>
              <circle cx={A.x} cy={A.y} r={isHi ? 2.4 : 1.7} fill={c} fillOpacity={isHi ? 1 : 0.8}/>
              <circle cx={B.x} cy={B.y} r={isHi ? 2.4 : 1.7} fill={c} fillOpacity={isHi ? 1 : 0.8}/>
            </g>
          );
        })}
      </g>
    );
  }

  // ---------- Axes (derivati da cuspidi I e X) ----------
  const axesUser: Axes | undefined = useMemo(() => {
    const a = user.houses?.[0], m = user.houses?.[9];
    return (typeof a === 'number' && typeof m === 'number') ? { asc: a, mc: m } : undefined;
  }, [user.houses]);
  const axesPerson: Axes | undefined = useMemo(() => {
    const a = person.houses?.[0], m = person.houses?.[9];
    return (typeof a === 'number' && typeof m === 'number') ? { asc: a, mc: m } : undefined;
  }, [person.houses]);

  return (
    <div className={className}>
      <svg viewBox={`0 0 ${size} ${size}`} className={responsive ? 'h-auto w-full' : undefined} role="img" aria-label="Synastry Pro Wheel">
        {/* sfondo leggero */}
        <circle cx={CX} cy={CY} r={r-1} fill="#ffffffff" stroke="#ffffffff" />

        {/* fascia segni */}
        {drawZodiac()}

        {/* case utente (anello più esterno) */}
        {drawHouseBand(user.houses, COLOR_USER, R_USER_OUT, R_USER_IN, false)}

        {/* case persona (anello interno) */}
        {drawHouseBand(person.houses, COLOR_PERSON, R_PERSON_OUT, R_PERSON_IN, true)}

        {/* assi */}
        {drawAxes(axesUser, COLOR_USER,   { showOpposites: true, flipMC: false })}
        {drawAxes(axesPerson, COLOR_PERSON,{ showOpposites: true, flipMC: false })}


        {/* tacche verticali per ogni pianeta sotto la fascia segni (dimensione configurabile) */}
        {/* tacche verticali sotto la fascia segni */}
        {drawPlanetTicksLabeled(userPts, 'user', COLOR_USER, highlighted)}
        {drawPlanetTicksLabeled(personPts, 'person', COLOR_PERSON, highlighted)}

        {/* aspetti al centro */}
        {drawAspects(aspects)}

        {/* pianeti (anti-overlap radiale) */}
        {drawPlanets(userDisp, COLOR_USER, 'user', highlighted)}
        {drawPlanets(personDisp, COLOR_PERSON, 'person', highlighted)}

        {/* legenda */}
        <g>
          <circle cx={16} cy={size-24} r={5} fill={COLOR_USER} />
          <text x={28} y={size-24} fontSize={11} dominantBaseline="middle" fill={TEXT}>User</text>
          <circle cx={76} cy={size-24} r={5} fill={COLOR_PERSON} />
          <text x={88} y={size-24} fontSize={11} dominantBaseline="middle" fill={TEXT}>Person</text>
        </g>
      </svg>
    </div>
  );
}
