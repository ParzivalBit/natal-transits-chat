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
// subito sotto i tipi, dentro SynastryWheelPro.tsx
type PtWithTheta = ChartPoint & { theta: number };

export type SynastryWheelProProps = {
  user:   { points: ChartPoint[]; houses?: number[]; axes?: Axes };
  person: { points: ChartPoint[]; houses?: number[]; axes?: Axes };
  aspects?: SAspect[];
  size?: number;
  responsive?: boolean;
  className?: string;
};

// ---------- Utility ----------
const norm360 = (d: number) => ((d % 360) + 360) % 360;

// ---------- Component ----------
export default function SynastryWheelPro({
  user,
  person,
  aspects = [],
  size = 560,
  responsive = true,
  className,
}: SynastryWheelProProps) {

  const r = size / 2;
  const CX = r, CY = r;

  // Geometrie (stile simile a Transits Pro, con due anelli case)
  const R_ZOD_OUT = r * 0.94;
  const R_ZOD_IN  = r * 0.87;

  const R_USER_OUT   = r * 0.84;   // bordo sup banda UTENTE
  const R_USER_IN    = r * 0.74;   // bordo inf banda UTENTE

  const R_PERSON_OUT = r * 0.70;   // bordo sup banda PERSONA
  const R_PERSON_IN  = r * 0.60;   // bordo inf banda PERSONA

  const R_ASPECT     = r * 0.48;   // hub aspetti e fascia numeri (leggermente interna)
  const R_CENTER     = r * 0.37;

  const COLOR_USER = '#1d4ed8';   // blu
  const COLOR_PERSON = '#f59e0b'; // arancione
  const GRID = '#6b7280';         // grigio scuro
  const GRID_MID = '#9ca3af';
  const GRID_LIGHT = '#e5e7eb';
  const TEXT = '#111827';

  // Rotazione: ASC utente a sinistra (ore 9)
  const rot = useMemo(() => norm360(270 - (user.axes?.asc ?? 180)), [user.axes?.asc]);
  const applyRot = useCallback((deg: number) => norm360(deg + rot), [rot]);

  // Pianeti (proiezione su anelli)
  const userPts = useMemo<PtWithTheta[]>(
    () => user.points.map(p => ({ ...p, theta: applyRot(norm360(p.lon)) })),
    [user.points, applyRot]
  );
  const personPts = useMemo<PtWithTheta[]>(
    () => person.points.map(p => ({ ...p, theta: applyRot(norm360(p.lon)) })),
    [person.points, applyRot]
  );

  // Hover state
  const [hover, setHover] = useState<{ kind:'planet'|'aspect'; key: string } | null>(null);

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
      const start = applyRot(i * 30);
      const mid = applyRot(i * 30 + 15);
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
      const a = applyRot(v);
      const pOut = polarToXY(CX, CY, rOuter, a);
      const pIn  = polarToXY(CX, CY, rInner, a);

      ticks.push(
        <line key={`tick-${color}-${i}`} x1={pOut.x} y1={pOut.y} x2={pIn.x} y2={pIn.y} stroke={color} strokeWidth={1.35} strokeOpacity={0.95} />
      );

      const arc = (next - v + 360) % 360;
      const mid = applyRot(v + arc / 2);
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
        <circle cx={CX} cy={CY} r={rOuter} fill="none" stroke={GRID_MID} />
        <circle cx={CX} cy={CY} r={rInner} fill="none" stroke={GRID_MID} />
        {ticks}
        {labels}
      </g>
    );
  }

  function drawAxes(ax: Axes | undefined, color: string) {
    if (!ax) return null;
    const asc = applyRot(ax.asc);
    const mc  = applyRot(ax.mc);

    const A1 = polarToXY(CX, CY, R_ZOD_OUT + 6, asc);
    const A2 = polarToXY(CX, CY, R_ZOD_IN - 6, asc);
    const M1 = polarToXY(CX, CY, R_ZOD_OUT + 6, mc);
    const M2 = polarToXY(CX, CY, R_ZOD_IN - 6, mc);

    const AcLab = polarToXY(CX, CY, R_ZOD_OUT + 12, asc);
    const McLab = polarToXY(CX, CY, R_ZOD_OUT + 12, mc);

    return (
      <g>
        <line x1={A1.x} y1={A1.y} x2={A2.x} y2={A2.y} stroke={color} strokeWidth={1.2} />
        <line x1={M1.x} y1={M1.y} x2={M2.x} y2={M2.y} stroke={color} strokeWidth={1.2} />
        <text x={AcLab.x} y={AcLab.y} fontSize={11} fill={color} textAnchor="middle" dominantBaseline="middle" style={{ fontWeight: 600 }}>AC</text>
        <text x={McLab.x} y={McLab.y} fontSize={11} fill={color} textAnchor="middle" dominantBaseline="middle" style={{ fontWeight: 600 }}>MC</text>
      </g>
    );
  }

  function drawPlanetTicks(points: { theta: number }[], color: string) {
    const nodes: React.ReactNode[] = [];
    for (let i = 0; i < points.length; i++) {
      const th = points[i]!.theta;
      const a  = polarToXY(CX, CY, R_ZOD_IN, th);
      const b  = polarToXY(CX, CY, R_ZOD_IN - 14, th);
      nodes.push(<line key={`pt-${color}-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={1} strokeOpacity={0.55}/>);
    }
    return <g>{nodes}</g>;
  }

  function drawPlanets(
  points: PtWithTheta[],
  color: string,
  ringR: number,
  owner: 'user' | 'person'
  ) {
    return (
      <g>
        {points.map((p) => {
          const pos = polarToXY(CX, CY, ringR, p.theta);
          const key = `${owner}:${p.name}`;
          const isActive = hover?.kind === 'planet' && hover.key === key;
          const labelColor = color;

          return (
            <g key={key}
               transform={`translate(${pos.x},${pos.y})`}
               onMouseEnter={() => setHover({ kind:'planet', key })}
               onMouseLeave={() => setHover(null)}
               style={{ cursor: 'pointer' }}>
              {isActive && <circle cx={0} cy={0} r={12} fill="none" stroke={labelColor} strokeWidth={1.5} />}
              <text
                x={0} y={0}
                fontSize={16}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={labelColor}
                fontFamily='"Noto Sans Symbols 2","Segoe UI Symbol","Apple Symbols","DejaVu Sans",sans-serif'
                aria-label={p.name}
              >
                {planetChar(p.name as PlanetName)}
              </text>
              {p.retro && <text x={8} y={-8} fontSize={9} fill={labelColor}>R</text>}
            </g>
          );
        })}
      </g>
    );
  }

  function drawAspects(list: SAspect[]) {
    if (!list || list.length === 0) return null;

    // Mappa nome -> theta per lookup veloce
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
        {/* sfondo */}
        <circle cx={CX} cy={CY} r={r-1} fill="#f8fafc" stroke="#e5e7eb" />

        {/* fascia segni */}
        {drawZodiac()}

        {/* case utente (anello più esterno) */}
        {drawHouseBand(user.houses, COLOR_USER, R_USER_OUT, R_USER_IN, false)}

        {/* case persona (anello interno) */}
        {drawHouseBand(person.houses, COLOR_PERSON, R_PERSON_OUT, R_PERSON_IN, true)}

        {/* assi */}
        {drawAxes(axesUser, COLOR_USER)}
        {drawAxes(axesPerson, COLOR_PERSON)}

        {/* tacche verticali per ogni pianeta sotto la fascia segni */}
        {drawPlanetTicks(userPts, COLOR_USER)}
        {drawPlanetTicks(personPts, COLOR_PERSON)}

        {/* aspetti al centro */}
        {drawAspects(aspects)}

        {/* pianeti */}
        {drawPlanets(userPts, COLOR_USER, (R_USER_OUT + R_USER_IN) / 2, 'user')}
        {drawPlanets(personPts, COLOR_PERSON, (R_PERSON_OUT + R_PERSON_IN) / 2, 'person')}

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
