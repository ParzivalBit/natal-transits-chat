// src/components/astro/SynastryWheelPro.tsx
'use client';

import React, { useMemo, useState } from 'react';
import type { ProPoint } from '@/lib/graphics/types';
import { PlanetName, ZodiacSign, planetChar, signColor } from '@/lib/graphics/glyphs';
import { aspectColor } from '@/lib/graphics/glyphs';
import { polarToXY, resolveCollisions } from '@/lib/graphics/polar';

type AspectType = 'conjunction' | 'opposition' | 'trine' | 'square' | 'sextile';

export default function SynastryWheelPro({
  title = 'SynastryWheelPro',
  a,
  b,
  size = 520,
  className,
  defaultOrb = 6,
  defaultAspects = ['conjunction','opposition','trine','square','sextile'] as AspectType[],
  responsive = true,
  useTextGlyphs = true,
}: {
  title?: string;
  a: ProPoint[];
  b: ProPoint[];
  size?: number;
  className?: string;
  defaultOrb?: number;
  defaultAspects?: AspectType[];
  responsive?: boolean;
  useTextGlyphs?: boolean;
}) {
  const r = size / 2;
  const innerR = r * 0.45;
  const aR = r * 0.65;
  const bR = r * 0.90;

  const [orb, setOrb] = useState<number>(defaultOrb);
  const [enabled, setEnabled] = useState<Record<AspectType, boolean>>({
    conjunction: defaultAspects.includes('conjunction'),
    opposition:  defaultAspects.includes('opposition'),
    trine:       defaultAspects.includes('trine'),
    square:      defaultAspects.includes('square'),
    sextile:     defaultAspects.includes('sextile'),
  });
  const [hoverAspectIdx, setHoverAspectIdx] = useState<number | null>(null);
  const [hoverPlanet, setHoverPlanet] = useState<{ ring: 'a' | 'b'; idx: number } | null>(null);
  const [focusPlanet, setFocusPlanet] = useState<{ ring: 'a' | 'b'; idx: number } | null>(null);

  const aAngles = useMemo(() => resolveCollisions(a.map(p => p.longitude), 8), [a]);
  const bAngles = useMemo(() => resolveCollisions(b.map(p => p.longitude), 8), [b]);

  const aspects = useMemo(() => {
    const defs = [
      { type: 'conjunction' as const, deg: 0 },
      { type: 'opposition'  as const, deg: 180 },
      { type: 'trine'       as const, deg: 120 },
      { type: 'square'      as const, deg: 90 },
      { type: 'sextile'     as const, deg: 60 },
    ];
    const rows: { i: number; j: number; type: AspectType }[] = [];
    for (let i = 0; i < a.length; i++) {
      for (let j = 0; j < b.length; j++) {
        const diff = Math.abs(a[i].longitude - b[j].longitude) % 360;
        const d = diff > 180 ? 360 - diff : diff;
        const found = defs.find(x => enabled[x.type] && Math.abs(d - x.deg) <= orb);
        if (found) rows.push({ i, j, type: found.type });
      }
    }
    return rows;
  }, [a, b, enabled, orb]);

  const aspectsByA = useMemo(() => {
    const m = new Map<number, number[]>();
    aspects.forEach((aAsp, idx) => {
      (m.get(aAsp.i) ?? m.set(aAsp.i, []).get(aAsp.i)!).push(idx);
    });
    return m;
  }, [aspects]);
  const aspectsByB = useMemo(() => {
    const m = new Map<number, number[]>();
    aspects.forEach((aAsp, idx) => {
      (m.get(aAsp.j) ?? m.set(aAsp.j, []).get(aAsp.j)!).push(idx);
    });
    return m;
  }, [aspects]);

  const highlightedAspects = useMemo(() => {
    const s = new Set<number>();
    if (hoverAspectIdx != null) s.add(hoverAspectIdx);
    if (hoverPlanet) {
      const arr = hoverPlanet.ring === 'a' ? (aspectsByA.get(hoverPlanet.idx) ?? []) : (aspectsByB.get(hoverPlanet.idx) ?? []);
      arr.forEach(x => s.add(x));
    }
    return s;
  }, [hoverAspectIdx, hoverPlanet, aspectsByA, aspectsByB]);

  const highlightedPlanets = useMemo(() => {
    const s = new Set<string>();
    if (hoverAspectIdx != null) {
      const aAsp = aspects[hoverAspectIdx];
      s.add(`a-${aAsp.i}`); s.add(`b-${aAsp.j}`);
    }
    if (hoverPlanet) {
      s.add(`${hoverPlanet.ring}-${hoverPlanet.idx}`);
      const arr = hoverPlanet.ring === 'a' ? (aspectsByA.get(hoverPlanet.idx) ?? []) : (aspectsByB.get(hoverPlanet.idx) ?? []);
      for (const idx of arr) {
        const aAsp = aspects[idx];
        s.add(`a-${aAsp.i}`); s.add(`b-${aAsp.j}`);
      }
    }
    if (focusPlanet) s.add(`${focusPlanet.ring}-${focusPlanet.idx}`);
    return s;
  }, [hoverAspectIdx, hoverPlanet, focusPlanet, aspects, aspectsByA, aspectsByB]);

  const buildAria = (p: ProPoint) => {
    const sign = p.sign ?? signFromLongitude(p.longitude);
    const deg = (p.longitude % 30 + 30) % 30;
    return `${p.name} ${deg.toFixed(1)}° ${sign}`;
  };

  return (
    <div className={`rounded-2xl border p-4 bg-white ${className ?? ''}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-medium">{title}</div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <label className="text-gray-600">orb</label>
            <input type="range" min={1} max={10} value={orb} onChange={(e) => setOrb(Number(e.target.value))} />
            <span className="w-6 text-right tabular-nums">{orb}°</span>
          </div>
          {(['conjunction','opposition','trine','square','sextile'] as AspectType[]).map(t => (
            <label key={t} className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={enabled[t]}
                onChange={(e) => setEnabled(s => ({ ...s, [t]: e.target.checked }))}
              />
              <span className="capitalize" style={{ color: aspectColor(t) }}>{t}</span>
            </label>
          ))}
        </div>
      </div>

      <svg
        role="img" aria-label={title}
        viewBox={`0 0 ${size} ${size}`}
        width={responsive ? '100%' : size}
        height={responsive ? 'auto' : size}
        className={responsive ? 'w-full h-auto' : undefined}
        style={responsive ? { aspectRatio: '1 / 1', display: 'block' } : undefined}
      >
        {/* sfondo */}
        {Array.from({ length: 12 }).map((_, i) => {
          const start = i * 30, end = start + 30;
          const path = describeSector(r, r, r - 10, start, end);
          const signs: ZodiacSign[] = [
            'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
            'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'
          ];
          return <path key={i} d={path} fill={signColor(signs[i])} fillOpacity={0.08} stroke="#e5e7eb" />;
        })}

        {/* aspetti + ticks */}
        {aspects.map((aAsp, idx) => {
          const aAngle = aAngles[aAsp.i];
          const bAngle = bAngles[aAsp.j];
          const p1 = polarToXY(r, r, innerR, aAngle);
          const p2 = polarToXY(r, r, innerR, bAngle);
          const hi = highlightedAspects.has(idx);
          return (
            <g key={idx} onMouseEnter={() => setHoverAspectIdx(idx)} onMouseLeave={() => setHoverAspectIdx(null)}>
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                    stroke={aspectColor(aAsp.type)} strokeWidth={hi ? 2.4 : 1.2} opacity={hi ? 1 : 0.95}/>
              <circle cx={p1.x} cy={p1.y} r={2} fill="#2563eb" />
              <circle cx={p2.x} cy={p2.y} r={2} fill="#ea580c" />
            </g>
          );
        })}

        {/* pianeti A (blu) */}
        {a.map((p, i) => {
          const angle = aAngles[i];
          const pos = polarToXY(r, r, aR, angle);
          const hi = highlightedPlanets.has(`a-${i}`);
          return (
            <g key={`a-${i}`}
               transform={`translate(${pos.x},${pos.y}) scale(${size/520})`}
               tabIndex={0} role="img" aria-label={buildAria(p)}
               onFocus={() => setFocusPlanet({ ring: 'a', idx: i })}
               onBlur={() => setFocusPlanet(null)}
               onMouseEnter={() => setHoverPlanet({ ring: 'a', idx: i })}
               onMouseLeave={() => setHoverPlanet(null)}
               style={{ cursor: 'pointer' }}>
              {hi && <circle r={13.5} fill="none" stroke="#2563eb" strokeWidth={2} opacity={0.85} />}
              <circle r={10} fill="white" stroke="#2563eb" strokeWidth={hi ? 1.8 : 1} />
              {useTextGlyphs && (
                <text textAnchor="middle" dominantBaseline="central" fontSize={12}
                      fontFamily='"Noto Sans Symbols 2","Segoe UI Symbol","Apple Symbols","DejaVu Sans",sans-serif'
                      fill="#2563eb">
                  {planetChar(p.name as PlanetName)}
                </text>
              )}
              <title>{buildAria(p)}</title>
            </g>
          );
        })}

        {/* pianeti B (arancio) */}
        {b.map((p, i) => {
          const angle = bAngles[i];
          const pos = polarToXY(r, r, bR, angle);
          const hi = highlightedPlanets.has(`b-${i}`);
          return (
            <g key={`b-${i}`}
               transform={`translate(${pos.x},${pos.y}) scale(${size/520})`}
               tabIndex={0} role="img" aria-label={buildAria(p)}
               onFocus={() => setFocusPlanet({ ring: 'b', idx: i })}
               onBlur={() => setFocusPlanet(null)}
               onMouseEnter={() => setHoverPlanet({ ring: 'b', idx: i })}
               onMouseLeave={() => setHoverPlanet(null)}
               style={{ cursor: 'pointer' }}>
              {hi && <circle r={13.5} fill="none" stroke="#ea580c" strokeWidth={2} opacity={0.85} />}
              <circle r={10} fill="white" stroke="#ea580c" strokeWidth={hi ? 1.8 : 1} />
              {useTextGlyphs && (
                <text textAnchor="middle" dominantBaseline="central" fontSize={12}
                      fontFamily='"Noto Sans Symbols 2","Segoe UI Symbol","Apple Symbols","DejaVu Sans",sans-serif'
                      fill="#ea580c">
                  {planetChar(p.name as PlanetName)}
                </text>
              )}
              <title>{buildAria(p)}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function signFromLongitude(longitude: number): ZodiacSign {
  const idx = Math.floor((((longitude % 360) + 360) % 360) / 30);
  const signs: ZodiacSign[] = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
  return signs[idx]!;
}
function describeSector(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = polarToXY(cx, cy, r, endDeg);
  const end = polarToXY(cx, cy, r, startDeg);
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}
