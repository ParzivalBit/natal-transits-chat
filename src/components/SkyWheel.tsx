// src/components/SkyWheel.tsx
'use client';

import React from 'react';

export type SkyPoint = {
  name: string;        // Sun..Pluto, ASC, MC
  longitude: number;   // 0..360
  sign: string;
  house: number | null;
  retro: boolean;
};

const GLYPH: Record<string, string> = {
  Sun: '☉',
  Moon: '☾',
  Mercury: '☿',
  Venus: '♀',
  Mars: '♂',
  Jupiter: '♃',
  Saturn: '♄',
  Uranus: '♅',
  Neptune: '♆',
  Pluto: '♇',
  ASC: 'ASC',
  MC: 'MC',
};

const SIGNS = [
  'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
  'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'
];

export default function SkyWheel({
  title,
  points,
}: {
  title: string;
  points: SkyPoint[];
}) {
  // dimensioni
  const size = 320;
  const r = size / 2;

  return (
    <div className="rounded-2xl border p-4 bg-white">
      <div className="mb-3 text-sm font-medium">{title}</div>
      <div
        className="relative mx-auto"
        style={{ width: size, height: size }}
        aria-label={title}
      >
        {/* cerchio esterno */}
        <div
          className="absolute inset-0 rounded-full border"
          aria-hidden="true"
        />
        {/* tacche segni (12) */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30) - 90; // 0° a destra → ruotiamo per avere 0° in alto
          return (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 origin-left"
              style={{
                transform: `rotate(${angle}deg) translateX(${r - 12}px)`,
                width: 12,
                height: 2,
                background: '#e5e7eb',
              }}
              aria-hidden="true"
            />
          );
        })}
        {/* etichette segni */}
        {SIGNS.map((s, i) => {
          const angle = (i * 30) - 90;
          const rr = r - 28;
          return (
            <div
              key={s}
              className="absolute left-1/2 top-1/2 text-[10px] text-gray-600"
              style={{
                transform: `rotate(${angle}deg) translateX(${rr}px) rotate(${-angle}deg)`,
                transformOrigin: '0 0',
              }}
              aria-hidden="true"
            >
              {s}
            </div>
          );
        })}
        {/* pianeti/punti */}
        {points.map((p, idx) => {
          const a = p.longitude - 90; // portiamo 0° in alto
          const rr = r - 56;
          const label = GLYPH[p.name] ?? p.name;
          return (
            <div
              key={`${p.name}-${idx}`}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs"
              style={{
                transform: `rotate(${a}deg) translate(${rr}px) rotate(${-a}deg)`,
              }}
              title={`${p.name} ${p.sign}${p.house ? ` · H${p.house}` : ''}${p.retro ? ' (R)' : ''}`}
            >
              <span className="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 bg-white">
                <span>{label}</span>
                <span className="text-[10px] text-gray-500">
                  {p.sign}{p.house ? `·${p.house}` : ''}{p.retro ? 'R' : ''}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
