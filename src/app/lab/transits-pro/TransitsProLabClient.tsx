'use client';

import React, { useMemo, useState } from 'react';
import TransitsWheelPro, {
  type ProPoint,
  type AspectType,
} from '@/components/astro/TransitsWheelPro';

type Props = {
  natalPoints?: ProPoint[] | null;
  transitPoints?: ProPoint[] | null;
};

const DEMO_NATAL: ProPoint[] = [
  { id: 'Sun', name: 'Sun', lonDeg: 15, kind: 'natal' },
  { id: 'Moon', name: 'Moon', lonDeg: 92, kind: 'natal' },
  { id: 'Mercury', name: 'Mercury', lonDeg: 40, kind: 'natal' },
  { id: 'Venus', name: 'Venus', lonDeg: 133, kind: 'natal' },
  { id: 'Mars', name: 'Mars', lonDeg: 278, kind: 'natal' },
];

const DEMO_TRANSITS: ProPoint[] = [
  { id: 'Sun', name: 'Sun', lonDeg: 195, kind: 'transit' },
  { id: 'Moon', name: 'Moon', lonDeg: 272, kind: 'transit' },
  { id: 'Mercury', name: 'Mercury', lonDeg: 220, kind: 'transit' },
  { id: 'Venus', name: 'Venus', lonDeg: 315, kind: 'transit' },
  { id: 'Mars', name: 'Mars', lonDeg: 75, kind: 'transit' },
];

const ALL_ASPECTS: AspectType[] = [
  'conjunction',
  'sextile',
  'square',
  'trine',
  'opposition',
];

export default function TransitsProLabClient({ natalPoints, transitPoints }: Props) {
  const [orbOffsetDeg, setOrbOffsetDeg] = useState<number>(0);
  const [enabled, setEnabled] = useState<Record<AspectType, boolean>>({
    conjunction: true,
    sextile: true,
    square: true,
    trine: true,
    opposition: true,
  });

  const haveNatal   = Array.isArray(natalPoints) && natalPoints.length > 0;
  const haveTransit = Array.isArray(transitPoints) && transitPoints.length > 0;

  const natalUse = useMemo<ProPoint[]>(
    () => (haveNatal ? (natalPoints as ProPoint[]) : DEMO_NATAL),
    [haveNatal, natalPoints]
  );

  const transitUse = useMemo<ProPoint[]>(
    () => (haveTransit ? (transitPoints as ProPoint[]) : DEMO_TRANSITS),
    [haveTransit, transitPoints]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-3 text-sm">
        <div className="font-medium">Debug dati</div>
        <div className="text-neutral-600">
          Natal ricevuti: <b>{Array.isArray(natalPoints) ? natalPoints.length : 0}</b> &nbsp;|&nbsp;
          Transiti ricevuti: <b>{Array.isArray(transitPoints) ? transitPoints.length : 0}</b>
        </div>
        {(!haveNatal || !haveTransit) && (
          <div className="mt-2 text-amber-700">
            Non sono arrivati dati completi dal parent. Mostro un <b>fallback demo</b> per verificare la UI.
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          Orb offset:
          <input
            type="range"
            min={-4}
            max={6}
            step={0.5}
            value={orbOffsetDeg}
            onChange={(e) => setOrbOffsetDeg(Number(e.target.value))}
          />
          <span className="w-12 text-right">
            {orbOffsetDeg >= 0 ? `+${orbOffsetDeg.toFixed(1)}°` : `${orbOffsetDeg.toFixed(1)}°`}
          </span>
        </label>

        {ALL_ASPECTS.map((key) => (
          <label key={key} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={enabled[key]}
              onChange={(e) =>
                setEnabled((prev) => ({ ...prev, [key]: e.target.checked }))
              }
            />
            {key}
          </label>
        ))}
      </div>

      <div className="overflow-x-auto">
        <TransitsWheelPro
          natalPoints={natalUse}
          transitPoints={transitUse}
          enabledAspects={enabled}
          orbOffsetDeg={orbOffsetDeg}
        />
      </div>
    </div>
  );
}
