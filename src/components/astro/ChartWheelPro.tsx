// src/components/astro/ChartWheelPro.tsx
'use client';

import React, { useMemo, useState } from 'react';
import { ProPoint } from '@/lib/graphics/types';
import {
  signColor,
  planetChar,
  PlanetName,
  ZodiacSign,
  signChar,
} from '@/lib/graphics/glyphs';
import { ASPECT_COLORS } from '@/lib/graphics/tokens';
import { polarToXY, resolveCollisions } from '@/lib/graphics/polar';

type Axes = { asc: number; mc: number };

export default function ChartWheelPro({
  title = 'ChartWheelPro (Natal)',
  points,
  houseCusps,
  axes,                 // opzionale
  size = 520,
  className,
  responsive = true,
  usePlanetBadges = false,
}: {
  title?: string;
  points: ProPoint[];
  houseCusps?: number[];
  axes?: Axes;
  size?: number;
  className?: string;
  responsive?: boolean;
  usePlanetBadges?: boolean;
}) {
  const r = size / 2;

  // —— RAGGI (dal centro verso l’esterno) ——
  const aspectsR          = r * 0.34;
  const housesNumR        = r * 0.48;
  const housesNumInnerR   = r * 0.44;
  const housesNumOuterR   = r * 0.52;
  const planetsR          = r * 0.76;
  const zodiacInnerR      = r * 0.86;
  const zodiacOuterR      = r * 0.98;

  // —— Assi: derivazione se non forniti —— //
  const baseAxes: Axes = useMemo(() => {
    if (axes) return { asc: norm(axes.asc), mc: norm(axes.mc) };
    if (houseCusps && houseCusps.length === 12) {
      return { asc: norm(houseCusps[0]!), mc: norm(houseCusps[9]!) };
    }
    return { asc: 180, mc: 90 }; // placeholder
  }, [axes, houseCusps]);

  // —— Rotazione ANGOLI (non testo): vogliamo AC a 270° (sinistra) —— //
  // polarToXY usa 0° in alto, 90° a destra, 180° in basso, 270° a sinistra.
  // Quindi rot = 270 - ASC.
  const rot = useMemo(() => norm(270 - baseAxes.asc), [baseAxes.asc]);
  const applyRot = (deg: number) => norm(deg + rot);

  const [hoverAspectIdx, setHoverAspectIdx] = useState<number | null>(null);
  const [hoverPlanetIdx, setHoverPlanetIdx] = useState<number | null>(null);
  const [focusPlanetIdx, setFocusPlanetIdx] = useState<number | null>(null);

  const planetAnglesRaw = useMemo(
    () => resolveCollisions(points.map(p => p.longitude), 8),
    [points]
  );

  // —— aspetti natal —— //
  const aspects = useMemo(() => {
    const results: { from: number; to: number; type: keyof typeof ASPECT_COLORS }[] = [];
    const defs = [
      { type: 'conjunction' as const, deg: 0 },
      { type: 'opposition'  as const, deg: 180 },
      { type: 'trine'       as const, deg: 120 },
      { type: 'square'      as const, deg: 90 },
      { type: 'sextile'     as const, deg: 60 },
    ];
    const orb = 6;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const diff = Math.abs(points[i].longitude - points[j].longitude) % 360;
        const d = diff > 180 ? 360 - diff : diff;
        const found = defs.find(a => Math.abs(d - a.deg) <= orb);
        if (found) results.push({ from: i, to: j, type: found.type });
      }
    }
    return results;
  }, [points]);

  const aspectsByPlanet = useMemo(() => {
    const map = new Map<number, number[]>();
    aspects.forEach((a, idx) => {
      (map.get(a.from) ?? map.set(a.from, []).get(a.from)!).push(idx);
      (map.get(a.to) ?? map.set(a.to, []).get(a.to)!).push(idx);
    });
    return map;
  }, [aspects]);

  const highlightedPlanets = useMemo(() => {
    const set = new Set<number>();
    if (hoverAspectIdx != null) {
      const a = aspects[hoverAspectIdx];
      if (a) { set.add(a.from); set.add(a.to); }
    }
    if (hoverPlanetIdx != null) {
      set.add(hoverPlanetIdx);
      const rel = aspectsByPlanet.get(hoverPlanetIdx) ?? [];
      for (const idx of rel) { const a = aspects[idx]; set.add(a.from); set.add(a.to); }
    }
    if (focusPlanetIdx != null) set.add(focusPlanetIdx);
    return set;
  }, [hoverAspectIdx, hoverPlanetIdx, focusPlanetIdx, aspects, aspectsByPlanet]);

  const highlightedAspects = useMemo(() => {
    const set = new Set<number>();
    if (hoverAspectIdx != null) set.add(hoverAspectIdx);
    if (hoverPlanetIdx != null) {
      const rel = aspectsByPlanet.get(hoverPlanetIdx) ?? [];
      for (const idx of rel) set.add(idx);
    }
    return set;
  }, [hoverAspectIdx, hoverPlanetIdx, aspectsByPlanet]);

  function buildAriaLabel(p: ProPoint): string {
    const sign = p.sign ?? signFromLongitude(p.longitude);
    const deg = (p.longitude % 30 + 30) % 30;
    return `${p.name} ${deg.toFixed(1)}° ${sign}`;
  }

  return (
    <div className={`rounded-2xl border p-4 bg-white ${className ?? ''}`}>
      <div className="mb-3 text-sm font-medium">{title}</div>

      <svg
        role="img"
        aria-label={title}
        viewBox={`0 0 ${size} ${size}`}
        width={responsive ? '100%' : size}
        height={responsive ? 'auto' : size}
        className={responsive ? 'w-full h-auto' : undefined}
        style={responsive ? { aspectRatio: '1 / 1', display: 'block' } : undefined}
      >
        {/* —— Zodiac band —— */}
        {Array.from({ length: 12 }).map((_, i) => {
          const path = describeDonutSector(
            r, r, zodiacOuterR, zodiacInnerR,
            applyRot(i * 30), applyRot(i * 30 + 30)
          );
          return <path key={`sec-${i}`} d={path} fill="white" stroke="none" />;
        })}
        {Array.from({ length: 12 }).map((_, i) => {
          const deg = applyRot(i * 30);
          const p1 = polarToXY(r, r, zodiacInnerR, deg);
          const p2 = polarToXY(r, r, zodiacOuterR, deg);
          return <line key={`sep-${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#111827" strokeWidth={1} opacity={0.7} />;
        })}
        <circle cx={r} cy={r} r={zodiacOuterR} fill="none" stroke="#111827" strokeWidth={1.5} />
        <circle cx={r} cy={r} r={zodiacInnerR} fill="none" stroke="#111827" strokeWidth={1} opacity={0.6} />

        {renderZodiacBandColored(r, size, (zodiacInnerR + zodiacOuterR) / 2, applyRot)}

        {/* —— Case —— */}
        {houseCusps && houseCusps.length === 12 && houseCusps.map((deg, i) => {
          const d = applyRot(deg);
          const p1 = polarToXY(r, r, 0, d);
          const p2 = polarToXY(r, r, zodiacInnerR, d);
          return <line key={`cusp-${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#9ca3af" strokeWidth={0.9} />;
        })}

        {/* —— Assi + etichette —— */}
        {renderAxes(r, size, { asc: applyRot(baseAxes.asc), mc: applyRot(baseAxes.mc) }, zodiacOuterR)}
        {renderAxisLabels(r, size, { asc: applyRot(baseAxes.asc), mc: applyRot(baseAxes.mc) }, zodiacOuterR)}

        {/* —— Rete aspetti —— */}
        {aspects.map((a, idx) => {
          const a1 = applyRot(planetAnglesRaw[a.from]);
          const a2 = applyRot(planetAnglesRaw[a.to]);
          const p1 = polarToXY(r, r, aspectsR, a1);
          const p2 = polarToXY(r, r, aspectsR, a2);
          const isHi = highlightedAspects.has(idx);
          return (
            <line
              key={idx}
              x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke={ASPECT_COLORS[a.type]}
              strokeWidth={isHi ? 2.6 : 1.2}
              opacity={isHi ? 1 : 0.75}
              onMouseEnter={() => setHoverAspectIdx(idx)}
              onMouseLeave={() => setHoverAspectIdx(null)}
            />
          );
        })}

        {/* —— Anello numeri case —— */}
        <circle cx={r} cy={r} r={housesNumInnerR} fill="none" stroke="#9ca3af" strokeWidth={0.8} opacity={0.7} />
        <circle cx={r} cy={r} r={housesNumOuterR} fill="none" stroke="#9ca3af" strokeWidth={0.8} opacity={0.7} />
        {houseCusps && houseCusps.length === 12 && renderHouseNumbers(r, size, housesNumR, houseCusps, applyRot)}

        {/* —— Pianeti —— */}
        {points.map((p, i) => {
          const aRot = applyRot(planetAnglesRaw[i]);

          const tickStartR = zodiacInnerR;
          const tickEndR   = zodiacInnerR - (zodiacInnerR - planetsR) * 0.45;

          const tickStart = polarToXY(r, r, tickStartR, aRot);
          const tickEnd   = polarToXY(r, r, tickEndR, aRot);
          const glyph     = polarToXY(r, r, planetsR, aRot);

          const isHi = highlightedPlanets.has(i) || focusPlanetIdx === i;
          const char = planetChar(p.name as PlanetName);
          const glyphFont = 14 * (size / 520);

          return (
            <g
              key={i}
              tabIndex={0}
              role="img"
              aria-label={buildAriaLabel(p)}
              onFocus={() => setFocusPlanetIdx(i)}
              onBlur={() => setFocusPlanetIdx(null)}
              onMouseEnter={() => setHoverPlanetIdx(i)}
              onMouseLeave={() => setHoverPlanetIdx(null)}
              style={{ cursor: 'pointer' }}
            >
              <line x1={tickStart.x} y1={tickStart.y} x2={tickEnd.x} y2={tickEnd.y} stroke="#111827" strokeWidth={0.9} opacity={0.85} />
              <circle cx={glyph.x} cy={glyph.y} r={9 * (size / 520)} fill="white" />
              <text
                x={glyph.x}
                y={glyph.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={glyphFont}
                fontFamily='"Noto Sans Symbols 2","Segoe UI Symbol","Apple Symbols","DejaVu Sans",sans-serif'
                fill="#111827"
                pointerEvents="none"
              >
                {char}
              </text>
              {usePlanetBadges ? (
                <>
                  <circle cx={glyph.x} cy={glyph.y} r={10 * (size / 520)} fill="white" stroke={isHi ? '#111827' : 'black'} strokeWidth={isHi ? 1.8 : 1} />
                  {isHi && <circle cx={glyph.x} cy={glyph.y} r={13.5 * (size / 520)} fill="none" stroke="#2563eb" strokeWidth={2} opacity={0.85} />}
                </>
              ) : (
                <>
                  <circle cx={glyph.x} cy={glyph.y} r={12 * (size / 520)} fill="transparent" pointerEvents="all" />
                  {isHi && <circle cx={glyph.x} cy={glyph.y} r={12.5 * (size / 520)} fill="none" stroke="#2563eb" strokeWidth={2} opacity={0.9} />}
                </>
              )}
              <title>{buildAriaLabel(p)}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Glifi dei segni colorati (testo diritto), con angoli ruotati */
function renderZodiacBandColored(
  cx: number,
  size: number,
  radius: number,
  applyRot: (deg: number) => number
) {
  const signs: ZodiacSign[] = [
    'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'
  ];
  return signs.map((s, i) => {
    const mid = applyRot(i * 30 + 15);
    const { x, y } = polarToXY(cx, cx, radius, mid);
    return (
      <text
        key={s}
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={14 * (size / 520)}
        fontFamily='"Noto Sans Symbols 2","Segoe UI Symbol","Apple Symbols","DejaVu Sans",sans-serif'
        fill={signColor(s)}
      >
        {signChar(s)}
      </text>
    );
  });
}

function renderAxes(
  r: number,
  size: number,
  axesRot: Axes,   // asc/mc già ruotati via applyRot
  outerRingR: number
) {
  // Invertiamo MC/IC per avere MC in alto e IC in basso
  const dc = norm(axesRot.asc + 180);
  const mcTop = norm(axesRot.mc + 180);
  const icBottom = norm(axesRot.mc);

  const items = [
    { deg: axesRot.asc, label: 'AC' },
    { deg: dc,          label: 'DC' },
    { deg: mcTop,       label: 'MC' },
    { deg: icBottom,    label: 'IC' },
  ];
  return (
    <g aria-label="Chart axes">
      {items.map((it, idx) => {
        const p1 = polarToXY(r, r, 0, it.deg);
        const p2 = polarToXY(r, r, outerRingR, it.deg);
        return (
          <line
            key={idx}
            x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
            stroke="#111827" strokeWidth={1.1} opacity={0.7}
          />
        );
      })}
    </g>
  );
}

function renderAxisLabels(
  r: number,
  size: number,
  axesRot: Axes,
  outerRingR: number
) {
  const labelR = outerRingR + 14 * (size / 520);
  const dc = norm(axesRot.asc + 180);
  const mcTop = norm(axesRot.mc + 180);
  const icBottom = norm(axesRot.mc);

  const items = [
    { deg: axesRot.asc, label: 'AC' },
    { deg: dc,          label: 'DC' },
    { deg: mcTop,       label: 'MC' },
    { deg: icBottom,    label: 'IC' },
  ];
  return (
    <g aria-label="Axis labels">
      {items.map((it, idx) => {
        const t = polarToXY(r, r, labelR, it.deg);
        return (
          <text
            key={idx}
            x={t.x}
            y={t.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11 * (size / 520)}
            fontFamily='ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial'
            fill="#111827"
          >
            {it.label}
          </text>
        );
      })}
    </g>
  );
}

/** Numeri delle case nel “middle” tra cusp[i] e cusp[i+1], con rotazione applicata */
function renderHouseNumbers(
  r: number,
  size: number,
  radius: number,
  cusps: number[],
  applyRot: (deg: number) => number
) {
  const items = Array.from({ length: 12 }).map((_, i) => {
    const a = applyRot(cusps[i]!);
    const b = applyRot(cusps[(i + 1) % 12]!);
    const mid = midAngle(a, b);
    const { x, y } = polarToXY(r, r, radius, mid);
    return { i: i + 1, x, y };
  });
  return (
    <g aria-label="House numbers">
      {items.map(({ i, x, y }) => (
        <text
          key={i}
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={12 * (size / 520)}
          fontFamily='ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial'
          fill="#111827"
          opacity={0.85}
        >
          {i}
        </text>
      ))}
    </g>
  );
}

function midAngle(a: number, b: number) {
  let d = norm(b - a);
  if (d > 180) d -= 360;
  return norm(a + d / 2);
}

function norm(deg: number) {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}

/** Settore ad anello (donut) tra due raggi */
function describeDonutSector(
  cx: number, cy: number,
  rOuter: number, rInner: number,
  startDeg: number, endDeg: number
): string {
  const startOuter = polarToXY(cx, cy, rOuter, endDeg);
  const endOuter   = polarToXY(cx, cy, rOuter, startDeg);
  const startInner = polarToXY(cx, cy, rInner, startDeg);
  const endInner   = polarToXY(cx, cy, rInner, endDeg);
  const delta = norm(endDeg - startDeg);
  const largeArc = delta <= 180 ? 0 : 1;
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 1 ${endInner.x} ${endInner.y}`,
    'Z',
  ].join(' ');
}

function signFromLongitude(longitude: number): ZodiacSign {
  const idx = Math.floor((((longitude % 360) + 360) % 360) / 30);
  const signs: ZodiacSign[] = [
    'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'
  ];
  return signs[idx]!;
}
