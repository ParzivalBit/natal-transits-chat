'use client';

import React from 'react';

export type ChartPoint = {
  name: string;             // 'Sun' | 'Moon' | ... | 'ASC' | 'MC'
  longitude: number;        // 0..360
  sign: string;             // Aries..Pisces
  house: number | null;     // 1..12 o null
  retro: boolean;
};

const SIGN_NAMES = [
  'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
  'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'
] as const;

function toRad(deg: number): number { return (deg * Math.PI) / 180; }

// 0° Ariete in alto; cresce in senso orario
function angleForLongitude(lon: number): number {
  return toRad((lon - 90 + 360) % 360);
}

export default function ChartWheel({ points }: { points: ChartPoint[] }) {
  const size = 480;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size * 0.48;
  const rSigns = size * 0.40;
  const rPoints = size * 0.35;

  const signs = SIGN_NAMES.map((s, i) => {
    const midLon = i * 30 + 15;
    const ang = angleForLongitude(midLon);
    const tx = cx + rSigns * Math.cos(ang);
    const ty = cy + rSigns * Math.sin(ang);
    return { s, i, tx, ty };
  });

  return (
    <svg width="100%" height="480" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Natal wheel">
      {/* cerchio esterno */}
      <circle cx={cx} cy={cy} r={rOuter} fill="white" stroke="#e5e7eb" strokeWidth="2" />
      {/* divisione 12 segni */}
      {Array.from({ length: 12 }).map((_, i) => {
        const lon = i * 30;
        const a = angleForLongitude(lon);
        const x = cx + rOuter * Math.cos(a);
        const y = cy + rOuter * Math.sin(a);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e7eb" strokeWidth="1" />;
      })}
      {/* etichette segni */}
      {signs.map(({ s, i, tx, ty }) => (
        <text key={i} x={tx} y={ty} fontSize="12" textAnchor="middle" dominantBaseline="middle" fill="#374151">
          {s}
        </text>
      ))}
      {/* punti (pianeti, ASC, MC) */}
      {points.map((p) => {
        const a = angleForLongitude(p.longitude);
        const x = cx + rPoints * Math.cos(a);
        const y = cy + rPoints * Math.sin(a);
        const label = p.name;
        const color = (p.name === 'ASC' || p.name === 'MC') ? '#1f2937' : '#111827';
        return (
          <g key={`${p.name}-${p.longitude.toFixed(2)}`}>
            <circle cx={x} cy={y} r={6} fill={color} opacity={0.9} />
            <text x={x + 10} y={y - 8} fontSize="11" fill="#111827">{label}</text>
            {p.house ? (
              <text x={x + 10} y={y + 8} fontSize="10" fill="#6b7280">{`${p.sign} • H${p.house}`}</text>
            ) : (
              <text x={x + 10} y={y + 8} fontSize="10" fill="#6b7280">{p.sign}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
