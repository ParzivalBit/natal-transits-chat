// FILE: src/components/astro/_parts.tsx
"use client";

import React from "react";
import type { Point } from "../../lib/aspects";
import { ASPECTS } from "../../lib/aspects";
import "./proTheme.css";

/* ===== utilities ===== */
const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
const X = (cx: number, r: number, deg: number) => cx + r * Math.cos(rad(deg));
const Y = (cy: number, r: number, deg: number) => cy + r * Math.sin(rad(deg));

/* ===== glifi & colori ===== */
const ZODIAC_GLYPH: Record<number, string> = {
  0: "♈", 30: "♉", 60: "♊", 90: "♋", 120: "♌", 150: "♍",
  180: "♎", 210: "♏", 240: "♐", 270: "♑", 300: "♒", 330: "♓",
};
const SIGN_COLOR_VAR: Record<number, string> = {
  0: "var(--sign-aries)",      30: "var(--sign-taurus)",
  60: "var(--sign-gemini)",    90: "var(--sign-cancer)",
  120: "var(--sign-leo)",      150: "var(--sign-virgo)",
  180: "var(--sign-libra)",    210: "var(--sign-scorpio)",
  240: "var(--sign-sagittarius)", 270: "var(--sign-capricorn)",
  300: "var(--sign-aquarius)", 330: "var(--sign-pisces)",
};

const PLANET_GLYPH: Record<string, string> = {
  Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂",
  Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇",
  NNode: "☊", SNode: "☋", Asc: "ASC", Mc: "MC",
};

/* ===== 1) Zodiac Ring ===== */
type ZodiacProps = { cx: number; cy: number; r: number };
export function ZodiacRingPro({ cx, cy, r }: ZodiacProps) {
  const stroke = "var(--wheel-stroke)";
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={stroke} strokeWidth={3} />
      {Array.from({ length: 12 }).map((_, i) => {
        const deg = i * 30;
        const x1 = X(cx, r - 18, deg), y1 = Y(cy, r - 18, deg);
        const x2 = X(cx, r, deg),     y2 = Y(cy, r, deg);
        return (
          <line key={`zdiv-${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={stroke} strokeWidth={2}/>
        );
      })}
      {Object.entries(ZODIAC_GLYPH).map(([degStr, glyph]) => {
        const base = Number(degStr);
        const deg = base + 15; // centro settore
        return (
          <text key={`zgl-${base}`} x={X(cx, r - 28, deg)} y={Y(cy, r - 28, deg) + 7}
            textAnchor="middle" fontSize={22} style={{ fill: SIGN_COLOR_VAR[base] }}>
            {glyph}
          </text>
        );
      })}
    </g>
  );
}

/* ===== 2) Houses Ring (dell'utente) ===== */
type HousesProps = { cx: number; cy: number; rOuter: number; rInner: number; cusps: number[] };
export function HousesRingPro({ cx, cy, rOuter, rInner, cusps }: HousesProps) {
  const grid = "var(--grid-strong)";
  return (
    <g>
      <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke={grid} />
      <circle cx={cx} cy={cy} r={rInner} fill="none" stroke={grid} />
      {cusps?.length === 12 && cusps.map((deg, i) => (
        <line key={`h-${i}`} x1={X(cx, rInner, deg)} y1={Y(cy, rInner, deg)}
          x2={X(cx, rOuter, deg)} y2={Y(cy, rOuter, deg)} stroke={grid} />
      ))}
    </g>
  );
}

/* ===== 3) Pianeti (oggi) ===== */
type PlanetGlyphsProps = {
  cx: number; cy: number; r: number; points: Point[];
  onHover?: (key: string | null)=>void; hoverSet?: Set<string> | null; ringId?: "t";
};
export function PlanetGlyphsPro({ cx, cy, r, points, onHover, hoverSet }: PlanetGlyphsProps) {
  return (
    <g>
      {points.map((p) => {
        const k = `t:${p.name}`;
        const active = !hoverSet || hoverSet.has(k);
        const x = X(cx, r, p.longitude), y = Y(cy, r, p.longitude);
        const glyph = PLANET_GLYPH[p.name] ?? p.name.slice(0,2);
        return (
          <g key={k} transform={`translate(${x},${y})`}
             onMouseEnter={()=>onHover?.(k)} onMouseLeave={()=>onHover?.(null)}
             style={{ cursor: "pointer" }}>
            <circle r={13} fill={active ? "var(--planet-fill)" : "var(--planet-fill-dim)"} />
            <text x={0} y={4} textAnchor="middle" fontSize={12} fill="var(--planet-label)">{glyph}</text>
          </g>
        );
      })}
    </g>
  );
}

/* ===== 4) Aspect Lines (oggi↔oggi) ===== */
type AspectLinesProps = {
  cx: number; cy: number; r: number;
  aspects: Array<{ a: string; b: string; aspect: keyof typeof ASPECTS; orb: number }>;
  idx: Map<string, number>; hoverSet: Set<string> | null;
};
const ASPECT_COLOR: Record<keyof typeof ASPECTS, string> = {
  conj: "var(--aspect-conjunction)",
  sext: "var(--aspect-sextile)",
  sq:   "var(--aspect-square)",
  tri:  "var(--aspect-trine)",
  opp:  "var(--aspect-opposition)",
};
export function AspectLinesStraightToday({ cx, cy, r, aspects, idx, hoverSet }: AspectLinesProps) {
  return (
    <g>
      {aspects.map((a, i) => {
        const d1 = idx.get(a.a), d2 = idx.get(a.b);
        if (d1 == null || d2 == null) return null;
        const key1 = `t:${a.a}`, key2 = `t:${a.b}`;
        const active = !hoverSet || hoverSet.has(key1) || hoverSet.has(key2);
        const x1 = X(cx, r, d1), y1 = Y(cy, r, d1);
        const x2 = X(cx, r, d2), y2 = Y(cy, r, d2);
        return (
          <line key={`${i}-${a.a}-${a.b}`} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={ASPECT_COLOR[a.aspect]} strokeOpacity={active ? 0.9 : 0.25}
            strokeWidth={active ? 1.8 : 0.8}/>
        );
      })}
    </g>
  );
}

/* ===== 5) Cerchi aspectogram ===== */
export function AspectGuides({ cx, cy, rOuter, rInner }:{cx:number;cy:number;rOuter:number;rInner:number}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="var(--grid-strong)" />
      <circle cx={cx} cy={cy} r={rInner} fill="none" stroke="var(--grid-stroke)" />
    </g>
  );
}
