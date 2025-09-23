// src/components/PeoplePanel.tsx
'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { assignHouses } from '@/lib/houses/placidus';
import { computePlanetsAtUTC, type RuntimePoint } from '@/lib/planets/runtime';

type HouseSystem = 'placidus' | 'whole';

type NatalPoint = { name: string; longitude: number; sign?: string };

type Props = {
  system: HouseSystem;
  natalCusps: number[];     // cuspidi NATALI dell'utente
  natalAsc?: number | null;
  natalMc?: number | null;
  natalPoints: NatalPoint[]; // punti NATALI dell'utente (per aspetti)
};

type ChartPoint = {
  name: string;
  longitude: number;
  sign: string;
  house: number | null;
  retro?: boolean | null;
};

const ChartWheel = dynamic<{
  points: ChartPoint[];
  houseCusps?: number[];
  mcDeg?: number;
  orientation?: 'by-asc' | 'by-mc';
  showHouseNumbers?: boolean;
  showZodiacRing?: boolean;
  size?: number;
  className?: string;
}>(() => import('@/components/ChartWheel'), { ssr: false });

function normDeg(x: number): number { return ((x % 360) + 360) % 360; }
function sepDeg(a: number, b: number): number {
  let d = Math.abs(normDeg(a) - normDeg(b));
  if (d > 180) d = 360 - d;
  return d;
}

type AspectDef = { name: string; angle: number; orb: number; weight: number };
const ASPECTS: AspectDef[] = [
  { name: 'Conjunction', angle: 0,   orb: 6, weight: 5 },
  { name: 'Opposition',  angle: 180, orb: 6, weight: 4 },
  { name: 'Square',      angle: 90,  orb: 5, weight: 4 },
  { name: 'Trine',       angle: 120, orb: 4, weight: 3 },
  { name: 'Sextile',     angle: 60,  orb: 3, weight: 2 },
];

function bestAspect(aLon: number, bLon: number) {
  const s = sepDeg(aLon, bLon);
  let best: { aspect: AspectDef; orb: number; score: number } | null = null;
  for (const a of ASPECTS) {
    const orb = Math.abs(s - a.angle);
    if (orb <= a.orb) {
      const score = a.weight * (1 - orb / a.orb);
      if (!best || score > best.score) best = { aspect: a, orb, score };
    }
  }
  return best;
}

function makeUTC(dateISO: string, timeHHmm: string, tzOffsetMin: number): Date {
  // Data/ora locali (della persona B) → UTC
  // Interpretiamo timeHHmm come HH:mm locali nel fuso indicato da tzOffsetMin.
  const [yyyy, mm, dd] = dateISO.split('-').map(Number);
  const [HH, MM] = timeHHmm.split(':').map(Number);
  const millisLocal = Date.UTC(yyyy, (mm - 1), dd, HH, MM, 0);
  const millisUTC = millisLocal - tzOffsetMin * 60_000;
  return new Date(millisUTC);
}

export default function PeoplePanel({
  system,
  natalCusps,
  //natalAsc,
  natalMc,
  natalPoints,
}: Props) {
  // Form “altra persona”
  const today = new Date();
  const defDateISO = today.toISOString().slice(0, 10);
  const [dateISO, setDateISO] = useState<string>(defDateISO);
  const [timeHHmm, setTimeHHmm] = useState<string>('12:00');
  const [tzOffsetMin, setTzOffsetMin] = useState<number>(0);

  const dateUTC = useMemo(() => makeUTC(dateISO, timeHHmm, tzOffsetMin), [dateISO, timeHHmm, tzOffsetMin]);

  // Pianeti della persona B alla data/ora inserite
  const otherPlanets: RuntimePoint[] = useMemo(
    () => computePlanetsAtUTC(dateUTC),
    [dateUTC]
  );

  // Proiezione sulle case NATALI dell'utente
  const pointsForWheel: ChartPoint[] = useMemo(
    () =>
      otherPlanets.map((p) => ({
        name: p.name,
        longitude: p.longitude,
        sign: p.sign,
        house: assignHouses(p.longitude, natalCusps),
        retro: false, // niente ℞
      })),
    [otherPlanets, natalCusps]
  );

  // Top 3 sinastria (altra persona -> aspetti ai punti natali dell'utente)
  const top3 = useMemo(() => {
    type Hit = { score: number; orb: number; aspect: string; other: string; user: string };
    const hits: Hit[] = [];
    for (const op of otherPlanets) {
      for (const np of natalPoints) {
        const match = bestAspect(op.longitude, np.longitude);
        if (match) {
          hits.push({
            score: Number(match.score.toFixed(3)),
            orb: Number(match.orb.toFixed(2)),
            aspect: match.aspect.name,
            other: op.name,
            user: np.name,
          });
        }
      }
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, 3);
  }, [otherPlanets, natalPoints]);

  return (
    <div className="space-y-4">
      {/* 1) Form dati altra persona */}
      <div className="rounded-2xl border p-4">
        <h3 className="font-semibold mb-3">Dati altra persona</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium mb-1">Data</label>
            <input
              type="date"
              value={dateISO}
              onChange={(e) => setDateISO(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm w-full"
            />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium mb-1">Ora (HH:mm)</label>
            <input
              type="time"
              value={timeHHmm}
              onChange={(e) => setTimeHHmm(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm w-full"
            />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium mb-1">Offset (minuti)</label>
            <input
              type="number"
              value={tzOffsetMin}
              onChange={(e) => setTzOffsetMin(parseInt(e.target.value || '0', 10))}
              className="border rounded-md px-3 py-2 text-sm w-full"
              placeholder="es. 60 per CET"
            />
            <p className="text-xs text-gray-500 mt-1">
              Esempi: CET inverno = +60, CEST estate = +120, UTC = 0, New York = -300 (inverno)
            </p>
          </div>
          <div className="col-span-2 md:col-span-1 flex items-end">
            <div className="text-xs text-gray-600">
              <div><span className="font-medium">UTC:</span> {dateUTC.toISOString().replace('.000', '').replace('T', ' ')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2) Ruota: pianeti dell’altra persona sulle case NATALI dell’utente */}
      <div className="rounded-2xl border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">
            Sinastria — {system === 'placidus' ? 'Placidus' : 'Whole Sign'}
          </h3>
          <span className="text-xs text-gray-500">Case: tema natale del consultante</span>
        </div>
        <ChartWheel
          points={pointsForWheel}
          houseCusps={natalCusps}
          mcDeg={natalMc ?? natalCusps[9]}
          orientation="by-asc"
          showZodiacRing
          showHouseNumbers
          size={520}
        />
      </div>

      {/* 3) Top 3 interazioni */}
      <div className="rounded-2xl border p-4">
        <h3 className="font-semibold mb-2">Top 3 aspetti (altra persona → tuoi punti)</h3>
        {top3.length === 0 ? (
          <p className="text-sm text-gray-600">Nessun aspetto rilevante entro gli orbi standard.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {top3.map((h, i) => (
              <li key={i} className="flex items-center justify-between">
                <span>
                  <span className="font-medium">{h.other}</span> {h.aspect}{' '}
                  <span className="font-medium">{h.user}</span>
                  <span className="text-gray-500"> (orb {h.orb}°)</span>
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-gray-100">score {h.score}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-gray-500">
          Ranking: Conj 5, Opp/Sq 4, Tr 3, Sx 2 (decresce linearmente con l’orb).
        </p>
      </div>
    </div>
  );
}
