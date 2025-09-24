// FILE: src/components/astro/DailySkyWheelPro.tsx
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
// Tipi
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
// Costanti (coerenti con ChartWheelPro)
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

// Orbi "base" (come deciso in Step 3); lo slider applica un offset globale
const ORBS_BASE: Record<AspectType, number> = {
  conjunction: 8,
  sextile: 4,
  square: 6,
  trine: 6,
  opposition: 8,
};

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
      fill={c} // solo glifo colorato, nessun contorno
      fontFamily='"Noto Sans Symbols 2","Segoe UI Symbol","Apple Symbols","DejaVu Sans",sans-serif'
    >
      {g}
    </text>
  );
}

// -------------------------------
// Props
// -------------------------------

export type DailySkyWheelProProps = {
  today: ProPoint[];
  /** Abilitazione per tipo di aspetto (default: tutti true) */
  enabledAspects?: Partial<Record<AspectType, boolean>>;
  /** Offset globale in gradi applicato agli orbi base (può essere negativo/positivo) */
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

export default function DailySkyWheelPro({
  today,
  enabledAspects,
  orbOffsetDeg = 0,
  size = 520,
  className,
  responsive = true,
}: DailySkyWheelProProps) {
  const uid = useId();

  // --- Geometrie (come concordato) ---
  const R_ZOD_OUT = 252;   // bordo esterno fascia segni
  const R_ZOD_IN  = 228;   // bordo interno fascia segni
  const R_PLANET  = 200;   // corona pianeti
  const R_ASPECT  = 150;   // hub aspetti
  const PLANET_TICK_LEN = 18;
  const PLANET_TICK_OPACITY = 0.28;
  const PLANET_TICK_WIDTH = 1.0;

  // Stato hover
  const [hoverPlanetId, setHoverPlanetId] = useState<string | null>(null);
  const [hoverAspectId, setHoverAspectId] = useState<string | null>(null);

  // Pianeti con posizioni e segni
  const planets = useMemo(() => {
    return today.map((p) => {
      const theta = norm360(p.lon);
      const posPlan = polarToXY(CX, CY, R_PLANET, theta);
      const posAsp  = polarToXY(CX, CY, R_ASPECT, theta);
      const s = signFromLongitude(p.lon);
      return {
        ...p,
        theta,
        x: posPlan.x, y: posPlan.y,
        ax: posAsp.x, ay: posAsp.y,
        signZ: s,
      };
    });
  }, [today]);

  // Mappa enabled (default tutti attivi)
  const enabled: Record<AspectType, boolean> = useMemo(() => {
    const allTrue: Record<AspectType, boolean> = {
      conjunction: true, sextile: true, square: true, trine: true, opposition: true,
    };
    return { ...allTrue, ...(enabledAspects ?? {}) };
  }, [enabledAspects]);

  // Orbi effettivi applicando l'offset (clamp min 0)
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

  // Calcolo aspetti (rispetta enabled + ORBS correnti)
  type BestMatch = { t: AspectType; exact: number; delta: number; strength: number };

const aspects = useMemo<InterAspect[]>(() => {
  const out: InterAspect[] = [];

  for (let i = 0; i < today.length; i++) {
    for (let j = i + 1; j < today.length; j++) {
      const a = today[i];
      const b = today[j];
      const d = angularDistance(a.lon, b.lon);

      let best: BestMatch | undefined;

      for (const t of Object.keys(ASPECTS_MAP) as AspectType[]) {
        if (!enabled[t]) continue; // skip se tipo disabilitato

        const exact = ASPECTS_MAP[t];
        const orb = ORBS[t];
        const delta = Math.abs(d - exact);

        if (delta <= orb) {
          const strength = orb === 0 ? 0 : 1 - delta / orb;
          if (!best || delta < best.delta) {
            best = { t, exact, delta, strength };
          }
        }
      }

      if (best) {
        out.push({
          id: `${a.id}-${b.id}-${best.t}`,
          a,
          b,
          type: best.t,
          exactAngle: best.exact,
          delta: best.delta,
          strength: best.strength,
        });
      }
    }
  }

  return out;
}, [today, enabled, ORBS]);

  // Hover sets
  const involvedAspects = useMemo(() => {
    if (hoverPlanetId) return new Set(aspects.filter(a => a.a.id === hoverPlanetId || a.b.id === hoverPlanetId).map(a => a.id));
    if (hoverAspectId) return new Set([hoverAspectId]);
    return new Set<string>();
  }, [hoverPlanetId, hoverAspectId, aspects]);

  const involvedPlanets = useMemo(() => {
    if (hoverPlanetId) {
      const ids = aspects
        .filter(a => a.a.id === hoverPlanetId || a.b.id === hoverPlanetId)
        .flatMap(a => [a.a.id, a.b.id]);
      return new Set<string>([hoverPlanetId, ...ids]);
    }
    if (hoverAspectId) {
      const a = aspects.find(x => x.id === hoverAspectId);
      if (a) return new Set<string>([a.a.id, a.b.id]);
    }
    return new Set<string>();
  }, [hoverPlanetId, hoverAspectId, aspects]);

  // Zodiac band (ticks + glifi)
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

  // --- Render ---
  return (
    <div className={className}>
      <svg
        width={responsive ? "100%" : size}
        height={responsive ? "100%" : size}
        viewBox="0 0 520 520"
        role="img"
        aria-label="Daily Sky Pro Wheel"
      >
        {/* Fascia segni */}
        <circle cx={CX} cy={CY} r={R_ZOD_OUT} fill="none" stroke="currentColor" strokeOpacity={STROKES.ringBold} strokeWidth={2.1} />
        <circle cx={CX} cy={CY} r={R_ZOD_IN}  fill="none" stroke="currentColor" strokeOpacity={STROKES.ringMid} strokeWidth={1.2} />

        {/* Ticks settore e glifi dei segni */}
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

        {/* Hub aspetti (cerchio interno) */}
        <circle cx={CX} cy={CY} r={R_ASPECT} fill="none" stroke="currentColor" strokeOpacity={STROKES.ringThin} />

        {/* Aspettogramma: linee tra proiezioni sull'hub */}
        {aspects.map((a) => {
          const A = planets.find(p => p.id === a.a.id)!;
          const B = planets.find(p => p.id === a.b.id)!;
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

        {/* Tacche per-pianeta (lunghezza fissa) */}
        {planets.map((p) => {
          const theta = p.theta;
          const tickStart = polarToXY(CX, CY, R_ZOD_IN, theta);
          const tickEnd   = polarToXY(CX, CY, R_ZOD_IN - PLANET_TICK_LEN, theta);
          return (
            <line
              key={`ptick-${p.id}`}
              x1={tickStart.x} y1={tickStart.y}
              x2={tickEnd.x}   y2={tickEnd.y}
              stroke="currentColor"
              strokeOpacity={PLANET_TICK_OPACITY}
              strokeWidth={PLANET_TICK_WIDTH}
            />
          );
        })}

        {/* Pianeti: nessun bordo di default; halo solo in hover/involved */}
        {planets.map((p) => {
          const involved = involvedPlanets.has(p.id);
          const sCol = signColor(p.signZ);
          const haloOpacity = involved ? STROKES.planetHaloHi : STROKES.planetHalo;
          const glyphSize = involved ? 18 : 16;
          const showHalo = involved || hoverPlanetId === p.id;
          const dimOthers = (hoverPlanetId || hoverAspectId) && !involved;

          return (
            <g
              key={p.id}
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
                  stroke={sCol}
                  strokeOpacity={haloOpacity}
                  strokeWidth={1.5}
                />
              )}
              <PlanetGlyph name={p.name} size={glyphSize} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
