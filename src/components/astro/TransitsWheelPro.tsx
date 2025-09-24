// FILE: src/components/astro/TransitsWheelPro.tsx
"use client";

import React, { useMemo, useState, useId } from "react";
import { polarToXY } from "@/lib/graphics/polar";
import {
  planetChar,
  signChar,
  signColor,
  aspectColor,
  type PlanetName,
  type ZodiacSign,
} from "@/lib/graphics/glyphs";

// -------------------------------
// Tipi condivisi
// -------------------------------

export type ProPoint = {
  id: string;      // "Sun" | ...
  name: string;
  lon: number;     // [0..360)
  retro?: boolean;
  sign?: string | null;
};

export type AspectType = "conjunction" | "sextile" | "square" | "trine" | "opposition";

export type InterAspect = {
  id: string;
  a: ProPoint;
  b: ProPoint;
  type: AspectType;
  exactAngle: number; // 0,60,90,120,180
  delta: number;      // distanza dall'esatto
  strength: number;   // 0..1
};

// -------------------------------
// Stilistica & Costanti
// -------------------------------

const STROKES = {
  ringThin: 0.22,
  ringMid: 0.28,
  ringBold: 0.9,
  aspects: 0.35,
  aspectsHi: 1.0,
  planetHalo: 0.35,
  planetHaloHi: 1.0,
};

const ASPECTS_MAP: Record<AspectType, number> = {
  conjunction: 0,
  sextile: 60,
  square: 90,
  trine: 120,
  opposition: 180,
};

// Orbi base
const ORBS_BASE: Record<AspectType, number> = {
  conjunction: 8,
  sextile: 4,
  square: 6,
  trine: 6,
  opposition: 8,
};

// Colori serie
const TRANSIT_GLYPH_COLOR = "#ea580c";   // orange-600
const NATAL_GLYPH_COLOR   = "#0284c7";   // sky-600
const TRANSIT_TICK_COLOR  = TRANSIT_GLYPH_COLOR;
const NATAL_TICK_COLOR    = NATAL_GLYPH_COLOR;

// Punti non planetari da escludere dall’anello dei pianeti (failsafe)
const BLOCKED_POINTS = new Set([
  "ASC","AC","Asc","Ascendant","MC","Midheaven","IC","DSC","DC","Desc","Descendant","Vertex","Lilith","Fortuna","?"
]);

// -------------------------------
// Utility
// -------------------------------

function norm360(d: number) {
  return ((d % 360) + 360) % 360;
}

function angularDistance(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

function midAngle(a: number, b: number) {
  const A = norm360(a);
  const B = norm360(b);
  const delta = ((B - A + 360) % 360);
  return norm360(A + delta / 2);
}

function signFromLongitude(longitude: number): ZodiacSign {
  const idx = Math.floor(norm360(longitude) / 30);
  const signs: ZodiacSign[] = [
    "Aries","Taurus","Gemini","Cancer","Leo","Virgo",
    "Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"
  ];
  return signs[idx]!;
}

function PlanetGlyph({ name, size, fill = "currentColor" }: { name: string; size: number; fill?: string }) {
  const g = planetChar(name as PlanetName) ?? "•";
  return (
    <text
      x={0}
      y={0}
      fontSize={size}
      textAnchor="middle"
      dominantBaseline="middle"
      aria-label={name}
      fill={fill}
      fontFamily='"Noto Sans Symbols 2","Segoe UI Symbol","Apple Symbols","DejaVu Sans",sans-serif'
    >
      {g}
    </text>
  );
}

function SignGlyph({ sign, size }: { sign: ZodiacSign; size: number }) {
  const g = signChar(sign);
  const c = signColor(sign);
  return (
    <text
      x={0}
      y={0}
      fontSize={size}
      textAnchor="middle"
      dominantBaseline="middle"
      aria-label={sign}
      fill={c}
      fontFamily='"Noto Sans Symbols 2","Segoe UI Symbol","Apple Symbols","DejaVu Sans",sans-serif'
    >
      {g}
    </text>
  );
}

// -------------------------------
// Props
// -------------------------------

export type TransitsWheelProProps = {
  today: ProPoint[];
  natal: ProPoint[];
  /** 12 cuspidi (gradi eclittici) del tema natale */
  houseCusps?: number[];
  enabledAspects?: Partial<Record<AspectType, boolean>>;
  orbOffsetDeg?: number;
  size?: number;
  className?: string;
  responsive?: boolean;
};

// -------------------------------
// Component
// -------------------------------

const CX = 260;
const CY = 260;

export default function TransitsWheelPro({
  today,
  natal,
  houseCusps,
  enabledAspects,
  orbOffsetDeg = 0,
  size = 520,
  className,
  responsive = true,
}: TransitsWheelProProps) {
  const uid = useId();

  // ===== Geometrie =====
  const R_ZOD_OUT = 252;
  const R_ZOD_IN  = 228;

  const R_NATAL   = 214;   // anello NATAL (puoi regolare)
  const R_TRANSIT = 200;   // anello TRANSITI (puoi regolare)

  // Hub aspetti + fascia numeri case
  const R_ASPECT  = 148;   // inner border fascia numeri + punto di ancoraggio aspetti
  const HOUSE_NUM_BAND_W = 20;
  const R_HOUSE_NUM_IN   = R_ASPECT;
  const R_HOUSE_NUM_OUT  = R_ASPECT + HOUSE_NUM_BAND_W;
  const R_HOUSE_NUM_MID  = (R_HOUSE_NUM_IN + R_HOUSE_NUM_OUT) / 2;
  const HOUSE_NUM_FONT   = 11;
  const HOUSE_NUM_TICK_W = 1.2;

  // Tacche verso i pianeti
  const PLANET_TICK_LEN = 18;
  const PLANET_TICK_OPACITY = 0.5;
  const PLANET_TICK_WIDTH = 1.2;

  // === Nuova fascia assi (AC/IC/DC/MC) esterna alla zodiac band ===
  const AXIS_LABEL_RADIUS   = R_ZOD_OUT + 10; // raggio su cui posare le label (fuori dalla fascia segni)
  const AXIS_TICK_OUT_LEN   = 8;              // lunghezza tacca esterna
  const AXIS_LABEL_FONT     = 11.5;
  const AXIS_COLOR          = "#111827";      // quasi nero

  // ===== Stato hover =====
  const [hoverPlanetId, setHoverPlanetId] = useState<string | null>(null);
  const [hoverAspectId, setHoverAspectId] = useState<string | null>(null);

  // ===== Filtra eventuali punti non planetari (ASC/MC...) =====
  const natalFiltered = useMemo(
    () => natal.filter((p) => !BLOCKED_POINTS.has(p.name)),
    [natal]
  );

  // ===== Pianeti su anelli + proiezione su hub =====
  const natalPlanets = useMemo(() => {
    return natalFiltered.map((p) => {
      const theta = norm360(p.lon);
      const posNat = polarToXY(CX, CY, R_NATAL, theta);
      const posAsp = polarToXY(CX, CY, R_ASPECT, theta);
      const s = signFromLongitude(p.lon);
      return { ...p, theta, x: posNat.x, y: posNat.y, ax: posAsp.x, ay: posAsp.y, signZ: s, band: "natal" as const };
    });
  }, [natalFiltered]);

  const transitPlanets = useMemo(() => {
    return today.map((p) => {
      const theta = norm360(p.lon);
      const posTr = polarToXY(CX, CY, R_TRANSIT, theta);
      const posAsp = polarToXY(CX, CY, R_ASPECT, theta);
      const s = signFromLongitude(p.lon);
      return { ...p, theta, x: posTr.x, y: posTr.y, ax: posAsp.x, ay: posAsp.y, signZ: s, band: "transit" as const };
    });
  }, [today]);

  // ===== Abilitazioni & Orbi =====
  const enabled: Record<AspectType, boolean> = useMemo(() => {
    const allTrue: Record<AspectType, boolean> = {
      conjunction: true, sextile: true, square: true, trine: true, opposition: true,
    };
    return { ...allTrue, ...(enabledAspects ?? {}) };
  }, [enabledAspects]);

  const ORBS: Record<AspectType, number> = useMemo(() => {
    const clamp = (v: number) => Math.max(0, v);
    return {
      conjunction: clamp(ORBS_BASE.conjunction + orbOffsetDeg),
      sextile:     clamp(ORBS_BASE.sextile     + orbOffsetDeg),
      square:      clamp(ORBS_BASE.square      + orbOffsetDeg),
      trine:       clamp(ORBS_BASE.trine       + orbOffsetDeg),
      opposition:  clamp(ORBS_BASE.opposition  + orbOffsetDeg),
    };
  }, [orbOffsetDeg]);

  // ===== Aspetti SOLO natal ↔ transit =====
  type BestMatch = { t: AspectType; exact: number; delta: number; strength: number };
  const aspects = useMemo<InterAspect[]>(() => {
    const out: InterAspect[] = [];
    for (const a of natalFiltered) {
      for (const b of today) {
        const d = angularDistance(a.lon, b.lon);
        let best: BestMatch | undefined;
        for (const t of Object.keys(ASPECTS_MAP) as AspectType[]) {
          if (!enabled[t]) continue;
          const exact = ASPECTS_MAP[t];
          const orb = ORBS[t];
          const delta = Math.abs(d - exact);
          if (delta <= orb) {
            const strength = orb === 0 ? 0 : 1 - delta / orb;
            if (!best || delta < best.delta) best = { t, exact, delta, strength };
          }
        }
        if (best) {
          out.push({
            id: `${a.id}-${b.id}-${best.t}`,
            a, b,
            type: best.t,
            exactAngle: best.exact,
            delta: best.delta,
            strength: best.strength,
          });
        }
      }
    }
    return out;
  }, [natalFiltered, today, enabled, ORBS]);

  // ===== Hover sets =====
  const involvedAspects = useMemo(() => {
    if (hoverPlanetId) return new Set(aspects.filter(x => x.a.id === hoverPlanetId || x.b.id === hoverPlanetId).map(x => x.id));
    if (hoverAspectId) return new Set([hoverAspectId]);
    return new Set<string>();
  }, [hoverPlanetId, hoverAspectId, aspects]);

  const involvedPlanets = useMemo(() => {
    if (hoverPlanetId) {
      const ids = aspects
        .filter(x => x.a.id === hoverPlanetId || x.b.id === hoverPlanetId)
        .flatMap(x => [x.a.id, x.b.id]);
      return new Set<string>([hoverPlanetId, ...ids]);
    }
    if (hoverAspectId) {
      const a = aspects.find(x => x.id === hoverAspectId);
      if (a) return new Set<string>([a.a.id, a.b.id]);
    }
    return new Set<string>();
  }, [hoverPlanetId, hoverAspectId, aspects]);

  // ===== Zodiac band (ticks + glifi) =====
  const zodiacMarks = useMemo(() => {
    const out: {
      sign: ZodiacSign; mid: number;
      tx1: number; ty1: number; tx2: number; ty2: number;
      gx: number; gy: number;
    }[] = [];
    for (let i = 0; i < 12; i++) {
      const sign = ([
        "Aries","Taurus","Gemini","Cancer","Leo","Virgo",
        "Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces",
      ] as ZodiacSign[])[i]!;
      const start = i * 30;
      const mid = start + 15;

      const t1 = polarToXY(CX, CY, R_ZOD_OUT, start);
      const t2 = polarToXY(CX, CY, R_ZOD_IN,  start);
      const g  = polarToXY(CX, CY, (R_ZOD_OUT + R_ZOD_IN) / 2, mid);

      out.push({
        sign, mid,
        tx1: t1.x, ty1: t1.y,
        tx2: t2.x, ty2: t2.y,
        gx: g.x, gy: g.y,
      });
    }
    return out;
  }, []);

  // ===== Case natali =====
  const houseLines = useMemo(() => {
    if (!houseCusps || houseCusps.length < 12) return [];
    return houseCusps.slice(0, 12).map((deg, i) => {
      const theta = norm360(deg);
      const { x, y } = polarToXY(CX, CY, R_ZOD_OUT, theta);
      const isAxis = i === 0 || i === 3 || i === 6 || i === 9; // ASC/IC/DSC/MC
      return { i, theta, x, y, isAxis };
    });
  }, [houseCusps]);

  const houseNumbers = useMemo(() => {
    if (!houseCusps || houseCusps.length < 12) return [];
    const cusps = houseCusps.slice(0, 12).map(norm360);
    const out: { n: number; theta: number; x: number; y: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const a = cusps[i]!;
      const b = cusps[(i + 1) % 12]!;
      const m = midAngle(a, b);
      const pos = polarToXY(CX, CY, R_HOUSE_NUM_MID, m);
      out.push({ n: i + 1, theta: m, x: pos.x, y: pos.y });
    }
    return out;
  }, [houseCusps, R_HOUSE_NUM_MID]);

  // ===== Etichette assi (AC/IC/DC/MC) esterne =====
  const axisLabels = useMemo(() => {
    if (!houseCusps || houseCusps.length < 12) return [];
    const cusps = houseCusps.slice(0, 12).map(norm360);
    // Indici convenzionali: 1=ASC, 4=IC, 7=DSC, 10=MC
    const items: { key: "AC"|"IC"|"DC"|"MC"; theta: number; tx1:number;ty1:number;tx2:number;ty2:number; lx:number;ly:number }[] = [];

    const defs: { key: "AC"|"IC"|"DC"|"MC"; idx: number }[] = [
      { key: "AC", idx: 0 },
      { key: "IC", idx: 3 },
      { key: "DC", idx: 6 },
      { key: "MC", idx: 9 },
    ];

    for (const d of defs) {
      const theta = cusps[d.idx]!;
      const tickOuter = polarToXY(CX, CY, R_ZOD_OUT + AXIS_TICK_OUT_LEN, theta);
      const tickInner = polarToXY(CX, CY, R_ZOD_OUT, theta);
      const labelPos  = polarToXY(CX, CY, AXIS_LABEL_RADIUS, theta);
      items.push({
        key: d.key,
        theta,
        tx1: tickInner.x, ty1: tickInner.y,
        tx2: tickOuter.x, ty2: tickOuter.y,
        lx: labelPos.x, ly: labelPos.y,
      });
    }
    return items;
  }, [houseCusps, AXIS_LABEL_RADIUS]);

  // ===== Render =====
  return (
    <div className={className}>
      <svg
        width={responsive ? "100%" : size}
        height={responsive ? "100%" : size}
        viewBox="0 0 520 520"
        role="img"
        aria-label="Transits Pro Wheel"
      >
        {/* Fascia segni */}
        <circle cx={CX} cy={CY} r={R_ZOD_OUT} fill="none" stroke="currentColor" strokeOpacity={STROKES.ringBold} strokeWidth={2.1} />
        <circle cx={CX} cy={CY} r={R_ZOD_IN}  fill="none"  stroke="currentColor" strokeOpacity={STROKES.ringMid}  strokeWidth={1.2} />

        {/* Case (linee radiali lunghe) */}
        {houseLines.map(({ i, x, y, isAxis }) => (
          <line
            key={`house-${i}-${uid}`}
            x1={CX}
            y1={CY}
            x2={x}
            y2={y}
            stroke="#111827"
            strokeOpacity={isAxis ? 0.55 : 0.25}
            strokeWidth={isAxis ? 1.15 : 0.9}
          />
        ))}

        {/* Ticks dei 12 settori + glifi dei segni */}
        {zodiacMarks.map((z, i) => (
          <g key={`z-${i}-${uid}`}>
            <line
              x1={z.tx1} y1={z.ty1}
              x2={z.tx2} y2={z.ty2}
              stroke="currentColor"
              strokeOpacity={STROKES.ringMid}
              strokeWidth={1}
            />
            <g transform={`translate(${z.gx}, ${z.gy})`}>
              <SignGlyph sign={z.sign} size={16} />
            </g>
          </g>
        ))}

        {/* ==== Fascia numerica delle case ==== */}
        <circle cx={CX} cy={CY} r={R_HOUSE_NUM_IN} fill="none" stroke="currentColor" strokeOpacity={STROKES.ringThin} />
        <circle cx={CX} cy={CY} r={R_HOUSE_NUM_OUT} fill="none" stroke="currentColor" strokeOpacity={STROKES.ringMid} strokeWidth={1.0} />
        {houseLines.map(({ i, theta }) => {
          const a = polarToXY(CX, CY, R_HOUSE_NUM_OUT, theta);
          const b = polarToXY(CX, CY, R_HOUSE_NUM_IN,  theta);
          return (
            <line
              key={`hnum-tick-${i}-${uid}`}
              x1={a.x} y1={a.y}
              x2={b.x} y2={b.y}
              stroke="currentColor"
              strokeOpacity={0.45}
              strokeWidth={HOUSE_NUM_TICK_W}
            />
          );
        })}
        {houseNumbers.map((hn) => (
          <text
            key={`hnum-${hn.n}-${uid}`}
            x={hn.x}
            y={hn.y}
            fontSize={HOUSE_NUM_FONT}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="currentColor"
            opacity={0.85}
            aria-label={`House ${hn.n}`}
            style={{ userSelect: "none" }}
          >
            {hn.n}
          </text>
        ))}

        {/* ==== Etichette assi esterne: AC / IC / DC / MC ==== */}
        {axisLabels.map((ax) => (
          <g key={`ax-${ax.key}-${uid}`}>
            {/* tacca che esce dalla fascia zodiacale */}
            <line
              x1={ax.tx1} y1={ax.ty1}
              x2={ax.tx2} y2={ax.ty2}
              stroke={AXIS_COLOR}
              strokeWidth={1.2}
              strokeOpacity={0.9}
            />
            {/* label esterna */}
            <text
              x={ax.lx}
              y={ax.ly}
              fontSize={AXIS_LABEL_FONT}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={AXIS_COLOR}
              style={{ userSelect: "none", fontWeight: 600 }}
            >
              {ax.key}
            </text>
          </g>
        ))}

        {/* ==== Hub aspetti (coincide con inner border fascia numeri) ==== */}
        <circle cx={CX} cy={CY} r={R_ASPECT} fill="none" stroke="currentColor" strokeOpacity={STROKES.ringThin} />

        {/* Aspetti natal ↔ transit */}
        {aspects.map((a) => {
          const A =
            natalPlanets.find(p => p.id === a.a.id) ??
            transitPlanets.find(p => p.id === a.a.id)!;
          const B =
            natalPlanets.find(p => p.id === a.b.id) ??
            transitPlanets.find(p => p.id === a.b.id)!;

          const isHi = involvedAspects.has(a.id);
          const c = aspectColor(a.type);
          const w = isHi ? 1.35 : 0.95;
          const op = isHi ? STROKES.aspectsHi : STROKES.aspects;

          return (
            <g key={a.id}
               onMouseEnter={() => setHoverAspectId(a.id)}
               onMouseLeave={() => setHoverAspectId(null)}>
              <line x1={A.ax} y1={A.ay} x2={B.ax} y2={B.ay} stroke={c} strokeOpacity={op} strokeWidth={w} />
              <circle cx={A.ax} cy={A.ay} r={isHi ? 2.3 : 1.6} fill={c} fillOpacity={op} />
              <circle cx={B.ax} cy={B.ay} r={isHi ? 2.3 : 1.6} fill={c} fillOpacity={op} />
            </g>
          );
        })}

        {/* Tacche per-pianeta — NATALI (azzurre) */}
        {natalPlanets.map((p) => {
          const theta = p.theta;
          const tickStart = polarToXY(CX, CY, R_ZOD_IN, theta);
          const tickEnd   = polarToXY(CX, CY, R_ZOD_IN - PLANET_TICK_LEN, theta);
          return (
            <line
              key={`ptick-natal-${p.id}`}
              x1={tickStart.x} y1={tickStart.y}
              x2={tickEnd.x}   y2={tickEnd.y}
              stroke={NATAL_TICK_COLOR}
              strokeOpacity={PLANET_TICK_OPACITY}
              strokeWidth={PLANET_TICK_WIDTH}
            />
          );
        })}

        {/* Tacche per-pianeta — TRANSITI (arancioni) */}
        {transitPlanets.map((p) => {
          const theta = p.theta;
          const tickStart = polarToXY(CX, CY, R_ZOD_IN, theta);
          const tickEnd   = polarToXY(CX, CY, R_ZOD_IN - PLANET_TICK_LEN, theta);
          return (
            <line
              key={`ptick-transit-${p.id}`}
              x1={tickStart.x} y1={tickStart.y}
              x2={tickEnd.x}   y2={tickEnd.y}
              stroke={TRANSIT_TICK_COLOR}
              strokeOpacity={PLANET_TICK_OPACITY}
              strokeWidth={PLANET_TICK_WIDTH}
            />
          );
        })}

        {/* Pianeti NATALI (glifi azzurri) */}
        {natalPlanets.map((p) => {
          const involved = involvedPlanets.has(p.id);
          const haloCol = signColor(p.signZ);
          const glyphSize = involved ? 18 : 16;
          const showHalo = involved || hoverPlanetId === p.id;
          const dimOthers = (hoverPlanetId || hoverAspectId) && !involved;

          return (
            <g
              key={`nat-${p.id}`}
              transform={`translate(${p.x}, ${p.y})`}
              onMouseEnter={() => setHoverPlanetId(p.id)}
              onMouseLeave={() => setHoverPlanetId(null)}
              style={{ cursor: "pointer", opacity: dimOthers ? 0.5 : 1 }}
            >
              {showHalo && (
                <circle
                  cx={0}
                  cy={0}
                  r={13}
                  fill="none"
                  stroke={haloCol}
                  strokeOpacity={STROKES.planetHaloHi}
                  strokeWidth={1.5}
                />
              )}
              <PlanetGlyph name={p.name} size={glyphSize} fill={NATAL_GLYPH_COLOR} />
            </g>
          );
        })}

        {/* Pianeti TRANSITI (glifi arancioni) */}
        {transitPlanets.map((p) => {
          const involved = involvedPlanets.has(p.id);
          const haloCol = signColor(p.signZ);
          const glyphSize = involved ? 18 : 16;
          const showHalo = involved || hoverPlanetId === p.id;
          const dimOthers = (hoverPlanetId || hoverAspectId) && !involved;

          return (
            <g
              key={`tr-${p.id}`}
              transform={`translate(${p.x}, ${p.y})`}
              onMouseEnter={() => setHoverPlanetId(p.id)}
              onMouseLeave={() => setHoverPlanetId(null)}
              style={{ cursor: "pointer", opacity: dimOthers ? 0.5 : 1 }}
            >
              {showHalo && (
                <circle
                  cx={0}
                  cy={0}
                  r={13}
                  fill="none"
                  stroke={haloCol}
                  strokeOpacity={STROKES.planetHaloHi}
                  strokeWidth={1.5}
                />
              )}
              <PlanetGlyph name={p.name} size={glyphSize} fill={TRANSIT_GLYPH_COLOR} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
