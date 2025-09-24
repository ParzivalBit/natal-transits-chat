// FILE: src/components/astro/DailyWheelPro.tsx
"use client";

import React, { useMemo, useState } from "react";
import { Point, ASPECTS } from "../../lib/aspects";
import {
  ZodiacRingPro,
  HousesRingPro,
  PlanetGlyphsPro,
  AspectLinesStraight,
} from "./_parts";

type Props = {
  natalPoints: Point[];
  natalCusps: number[];
  todayPoints: Point[];
  todayCusps: number[];
  aspects: Array<{ t: string; n: string; aspect: keyof typeof ASPECTS; orb: number }>;
  className?: string;
};

export default function DailyWheelPro({
  natalPoints,
  natalCusps,
  todayPoints,
  aspects,
  className,
}: Props) {
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  const hoverFilter = useMemo(() => {
    if (!hoverKey) return null;
    const [, name] = hoverKey.split(":");
    return new Set<string>([`n:${name}`, `t:${name}`]);
  }, [hoverKey]);

  const natalIndex = useMemo(() => {
    const m = new Map<string, number>();
    natalPoints.forEach((p) => m.set(p.name, p.longitude));
    return m;
  }, [natalPoints]);

  const todayIndex = useMemo(() => {
    const m = new Map<string, number>();
    todayPoints.forEach((p) => m.set(p.name, p.longitude));
    return m;
  }, [todayPoints]);

  const width = 720;
  const height = 720;
  const cx = width / 2;
  const cy = height / 2;

  const R_ZODIAC = 320;
  const R_HOUSES_OUT = 292;
  const R_HOUSES_IN = 250;
  const R_PLANETS_NATAL = 238;
  const R_PLANETS_TRANSIT = 200;
  const R_ASPECT_OUT = 170;
  const R_ASPECT_IN = 80;

  return (
    <div className={className ?? ""}>
      <svg width={width} height={height} role="img" aria-label="Daily Pro Wheel">
        <defs>
          <filter id="soft-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.6" />
          </filter>
          <clipPath id="clip-aspects">
            <circle cx={cx} cy={cy} r={R_ASPECT_OUT} />
          </clipPath>
        </defs>

        <ZodiacRingPro cx={cx} cy={cy} r={R_ZODIAC} />
        <HousesRingPro cx={cx} cy={cy} rOuter={R_HOUSES_OUT} rInner={R_HOUSES_IN} cusps={natalCusps} />

        <PlanetGlyphsPro
          cx={cx}
          cy={cy}
          r={R_PLANETS_NATAL}
          points={natalPoints}
          ringId="n"
          onHover={setHoverKey}
          hoverFilter={hoverFilter}
        />
        <PlanetGlyphsPro
          cx={cx}
          cy={cy}
          r={R_PLANETS_TRANSIT}
          points={todayPoints}
          ringId="t"
          onHover={setHoverKey}
          hoverFilter={hoverFilter}
        />

        <g clipPath="url(#clip-aspects)">
          <AspectLinesStraight
            cx={cx}
            cy={cy}
            rOuter={R_ASPECT_OUT}
            aspects={aspects}
            natalIndex={natalIndex}
            todayIndex={todayIndex}
            hoverFilter={hoverFilter}
          />
        </g>

        <circle cx={cx} cy={cy} r={R_ASPECT_OUT} fill="none" stroke="currentColor" strokeOpacity="0.1" />
        <circle cx={cx} cy={cy} r={R_ASPECT_IN} fill="none" stroke="currentColor" strokeOpacity="0.08" />
      </svg>
    </div>
  );
}
