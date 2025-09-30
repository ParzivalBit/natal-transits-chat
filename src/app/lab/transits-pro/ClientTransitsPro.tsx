'use client';

import React, { useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import TransitsWheelPro, {
  type ProPoint as WheelPoint,
  type AspectType,
} from '@/components/astro/TransitsWheelPro';

type HouseSystem = 'placidus' | 'whole';

type Props = {
  today: WheelPoint[];
  natal: WheelPoint[];
  houseCusps?: number[];
  /** sistema case attualmente calcolato lato server (per copia UI) */
  houseSystemShown?: HouseSystem;
};

const ALL_ASPECTS: AspectType[] = [
  'conjunction',
  'sextile',
  'square',
  'trine',
  'opposition',
];

export default function ClientTransitsPro({
  today,
  natal,
  houseCusps,
  houseSystemShown = 'placidus',
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Controlli realtime
  const [flags, setFlags] = useState<Record<AspectType, boolean>>({
    conjunction: true,
    sextile: true,
    square: true,
    trine: true,
    opposition: true,
  });
  const [orbOffsetDeg, setOrbOffsetDeg] = useState<number>(0);

  // Dati
  const transitPoints = useMemo<WheelPoint[]>(
    () => (Array.isArray(today) ? today : []),
    [today]
  );
  const natalPoints = useMemo<WheelPoint[]>(
    () => (Array.isArray(natal) ? natal : []),
    [natal]
  );

  const countNatal = natalPoints.length;
  const countTransit = transitPoints.length;

  // Aggiorna la query mantenendo il resto (usiamo 'house' per compatibilità con la page)
  const updateQuery = (kv: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(searchParams?.toString() ?? '');
    for (const [k, v] of Object.entries(kv)) {
      if (!v) sp.delete(k);
      else sp.set(k, v);
    }
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  const onChangeHouseSystem = (value: HouseSystem) => {
    updateQuery({ house: value }); // la page ricalcola le cuspidi in base a ?house=
  };

  return (
    <div className="px-4 py-6 space-y-4">
      {/* Pannello controlli — stile people-pro */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        {/* Riga 1: Select sistema + label Mostrando */}
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="system" className="text-sm text-gray-700">
            Sistema case:
          </label>
          <select
            id="system"
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
            value={houseSystemShown}
            onChange={(e) =>
              onChangeHouseSystem(e.target.value === 'whole' ? 'whole' : 'placidus')
            }
          >
            <option value="placidus">Placidus</option>
            <option value="whole">Whole Sign</option>
          </select>
          <div className="text-xs text-gray-500">
            Mostrando: <b>{houseSystemShown === 'placidus' ? 'Placidus' : 'Whole Sign'}</b>
          </div>
        </div>

        {/* Riga 2: checkboxes aspetti */}
        <div className="flex flex-wrap gap-6">
          {ALL_ASPECTS.map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={flags[key]}
                onChange={(e) =>
                  setFlags((prev) => ({ ...prev, [key]: e.target.checked }))
                }
              />
              {/* Capitalize per allineare al people-pro */}
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </label>
          ))}
        </div>

        {/* Riga 3: slider orb a tutta larghezza */}
        <div>
          <div className="mb-1 text-sm text-slate-700">
            Orb globale (± gradi):{' '}
            <b>{orbOffsetDeg > 0 ? `+${orbOffsetDeg}°` : `${orbOffsetDeg}°`}</b>
          </div>
          <input
            type="range"
            min={-6}
            max={+6}
            step={1}
            value={orbOffsetDeg}
            onChange={(e) => setOrbOffsetDeg(Number(e.target.value))}
            className="w-full"
            aria-label="Orb globale"
          />
          <div className="mt-1 text-xs text-slate-500">
            Applica un offset agli orbi base (conj 8°, sext 4°, sq 6°, tr 6°, opp 8°).
          </div>
        </div>
      </div>

      {/* Debug sintetico come in people-pro */}
      <div className="rounded-md border border-gray-200 bg-white p-2 text-xs text-neutral-600 shadow-sm">
        Natal: <b>{countNatal}</b> — Transiti: <b>{countTransit}</b> — Cuspidi:{" "}
        <b>{houseCusps?.length ?? 0}</b>
      </div>

      {/* Ruota */}
      <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="mx-auto w-full max-w-[800px]">
          <TransitsWheelPro
            natalPoints={natalPoints}
            transitPoints={transitPoints}
            houseCusps={houseCusps}
            enabledAspects={flags}
            orbOffsetDeg={orbOffsetDeg}
            // opzionali di layout disponibili:
            // planetTickLen={18}
            // userGlyphOffset={6}
            responsive
          />
        </div>
      </div>
    </div>
  );
}
