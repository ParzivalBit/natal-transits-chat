// src/components/TransitsPanel.tsx
'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { computeDailyPlanets, type RuntimePoint } from '@/lib/planets/runtime';
import { assignHouses } from '@/lib/houses/placidus';

type NatalPoint = { name: string; longitude: number; sign?: string };
type HouseSystem = 'placidus' | 'whole';

type Props = {
  system: HouseSystem;
  natalCusps: number[];     // 12 cuspidi in gradi 0..360
  natalAsc?: number | null; // opzionale
  natalMc?: number | null;  // opzionale
  natalPoints: NatalPoint[]; // posizioni natali per calcolo aspetti
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
  // distanza angolare 0..180
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

function bestAspect(tLon: number, nLon: number) {
  const s = sepDeg(tLon, nLon);
  let best: { aspect: AspectDef; orb: number; score: number } | null = null;
  for (const a of ASPECTS) {
    const orb = Math.abs(s - a.angle);
    if (orb <= a.orb) {
      const score = a.weight * (1 - orb / a.orb); // 0..weight
      if (!best || score > best.score) best = { aspect: a, orb, score };
    }
  }
  return best;
}

export default function TransitsPanel({ system, natalCusps, natalMc, natalPoints }: Props) {
  // inizializzo il date picker all'oggi (UTC)
  const todayISO = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const [dateISO, setDateISO] = useState<string>(todayISO);

  const dateUTC = useMemo(() => new Date(`${dateISO}T00:00:00Z`), [dateISO]);

  // Pianeti in transito per la data selezionata
  const transitPlanets: RuntimePoint[] = useMemo(
    () => computeDailyPlanets(dateUTC),
    [dateUTC]
  );

  // Assegno la casa in base alle cuspidi NATALI selezionate
  const pointsForWheel: ChartPoint[] = useMemo(
    () =>
      transitPlanets.map(p => ({
        name: p.name,
        longitude: p.longitude,
        sign: p.sign,
        house: assignHouses(p.longitude, natalCusps),
        retro: false, // evito il simbolo ℞/Px nella ruota dei transiti
      })),
    [transitPlanets, natalCusps]
  );

  // “Top 3” transiti del giorno contro i punti natali
  const top3 = useMemo(() => {
    type Hit = { score: number; orb: number; aspect: string; tName: string; nName: string };
    const hits: Hit[] = [];
    for (const t of transitPlanets) {
      for (const n of natalPoints) {
        const match = bestAspect(t.longitude, n.longitude);
        if (match) {
          hits.push({
            score: Number(match.score.toFixed(3)),
            orb: Number(match.orb.toFixed(2)),
            aspect: match.aspect.name,
            tName: t.name,
            nName: n.name,
          });
        }
      }
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, 3);
  }, [transitPlanets, natalPoints]);

  return (
    <div className="space-y-4">
      {/* 1) Date picker */}
      <div>
        <label className="block text-sm font-medium mb-1">Seleziona data</label>
        <input
          type="date"
          className="border rounded-md px-3 py-2 text-sm"
          value={dateISO}
          onChange={(e) => setDateISO(e.target.value)}
        />
      </div>

      {/* 2) Ruota: pianeti in transito sulle case natali */}
      <div className="rounded-2xl border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">
            Transits — {system === 'placidus' ? 'Placidus' : 'Whole Sign'}
          </h3>
          <span className="text-xs text-gray-500">{dateISO} (UTC)</span>
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

      {/* 3) Top 3 transiti */}
      <div className="rounded-2xl border p-4">
        <h3 className="font-semibold mb-2">Top 3 transiti del giorno</h3>
        {top3.length === 0 ? (
          <p className="text-sm text-gray-600">Nessun aspetto rilevante entro gli orbi standard.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {top3.map((h, i) => (
              <li key={i} className="flex items-center justify-between">
                <span>
                  <span className="font-medium">{h.tName}</span> {h.aspect}{' '}
                  <span className="font-medium">{h.nName}</span>
                  <span className="text-gray-500"> (orb {h.orb}°)</span>
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-gray-100">score {h.score}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-gray-500">
          Ranking basato su pesi: Conj 5, Opp/Sq 4, Tr 3, Sx 2; ridotto linearmente con l’orb.
        </p>
      </div>
    </div>
  );
}
