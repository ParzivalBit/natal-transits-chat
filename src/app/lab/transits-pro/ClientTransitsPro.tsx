// FILE: src/app/lab/transits-pro/ClientTransitsPro.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const ALL_ASPECTS: AspectType[] = ['conjunction', 'sextile', 'square', 'trine', 'opposition'];

export default function ClientTransitsPro({
  today,
  natal,
  houseCusps,
  houseSystemShown = 'placidus',
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // --- Controlli realtime ---
  const [flags, setFlags] = useState<Record<AspectType, boolean>>({
    conjunction: true,
    sextile: true,
    square: true,
    trine: true,
    opposition: true,
  });
  const [orbOffsetDeg, setOrbOffsetDeg] = useState<number>(0);

  // --- Dati ---
  const transitPoints = useMemo<WheelPoint[]>(
    () => (Array.isArray(today) ? today : []),
    [today]
  );
  const natalPoints = useMemo<WheelPoint[]>(
    () => (Array.isArray(natal) ? natal : []),
    [natal]
  );

  // --- Sync query (?house=) ---
  const updateQuery = (kv: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(searchParams?.toString() ?? '');
    for (const [k, v] of Object.entries(kv)) {
      if (!v) sp.delete(k);
      else sp.set(k, v);
    }
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  };
  const onChangeHouseSystem = (value: HouseSystem) => updateQuery({ house: value });

  // --- Adattamento RUOTA alla colonna di destra ---
  const wheelColRef = useRef<HTMLDivElement | null>(null);
  const [wheelPx, setWheelPx] = useState<number>(520);

  useEffect(() => {
    const el = wheelColRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const fromTop = Math.ceil(rect.top);
      const safety = 32;
      const heightAvail = Math.max(240, window.innerHeight - fromTop - safety);
      const size = Math.max(260, Math.min(width, heightAvail));
      setWheelPx(size);
    };

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    measure();

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // --- Adattamento SLIDER verticale: riempi tra checkbox (sopra) e descrizione (sotto) ---
  const sliderBoxRef = useRef<HTMLDivElement | null>(null);
  const [sliderLen, setSliderLen] = useState<number>(200); // px = altezza slot disponibile

  useEffect(() => {
    const el = sliderBoxRef.current;
    if (!el) return;

    const read = () => {
      const h = Math.max(120, Math.floor(el.getBoundingClientRect().height));
      setSliderLen(h);
    };

    const ro = new ResizeObserver(read);
    ro.observe(el);
    read();

    return () => {
      ro.disconnect();
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Griglia adattiva: colonna sinistra stretta + ruota a destra */}
      <div
        className="
          grid gap-4 md:items-stretch md:h-full
          md:grid-cols-[clamp(160px,16vw,240px)_1fr]
          lg:grid-cols-[clamp(170px,14vw,260px)_1fr]
          xl:grid-cols-[clamp(180px,12vw,280px)_1fr]
        "
      >
        {/* --- Colonna SINISTRA: pannello controlli (una sola colonna) --- */}
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:h-full md:self-stretch flex flex-col">
          {/* Sistema case */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label htmlFor="system" className="text-sm text-gray-700">Sistema case:</label>
              <select
                id="system"
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
                value={houseSystemShown}
                onChange={(e) => onChangeHouseSystem(e.target.value === 'whole' ? 'whole' : 'placidus')}
              >
                <option value="placidus">Placidus</option>
                <option value="whole">Whole Sign</option>
              </select>
            </div>
            <div className="text-xs text-gray-500">
              Mostrando: <b>{houseSystemShown === 'placidus' ? 'Placidus' : 'Whole Sign'}</b>
            </div>
          </div>

          {/* ---- MOBILE (< md): checkbox + slider orizzontale + descrizione ---- */}
          <div className="mt-4 md:hidden space-y-3">
            <div className="text-sm font-medium">Aspetti</div>
            <div className="flex flex-col gap-2">
              {ALL_ASPECTS.map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={flags[key]}
                    onChange={(e) => setFlags((prev) => ({ ...prev, [key]: e.target.checked }))}
                  />
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </label>
              ))}
            </div>

            <div>
              <div className="mb-1 text-sm text-slate-700">
                Orb globale (± gradi): <b>{orbOffsetDeg > 0 ? `+${orbOffsetDeg}°` : `${orbOffsetDeg}°`}</b>
              </div>
              <input
                type="range"
                min={-6}
                max={+6}
                step={1}
                value={orbOffsetDeg}
                onChange={(e) => setOrbOffsetDeg(Number(e.target.value))}
                className="block w-full"
                aria-label="Orb globale"
              />
              <div className="mt-1 text-xs text-slate-500">
                Offset agli orbi base (conj 8°, sext 4°, sq 6°, tr 6°, opp 8°).
              </div>
            </div>
          </div>

          {/* ---- DESKTOP (>= md): UNA SOLA COLONNA: checkbox → slider (riempi) → descrizione ---- */}
          <div className="mt-4 hidden md:flex md:flex-col md:min-h-0">
            {/* Titolo + checkbox */}
            <div className="text-sm font-medium">Aspetti</div>
            <div className="mt-2 flex flex-col gap-2">
              {ALL_ASPECTS.map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={flags[key]}
                    onChange={(e) => setFlags((prev) => ({ ...prev, [key]: e.target.checked }))}
                  />
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </label>
              ))}
            </div>

            {/* SLOT SLIDER: occupa tutto lo spazio tra checkbox (sopra) e descrizione (sotto) */}
            <div ref={sliderBoxRef} className="flex-1 min-h-[520px] relative mt-3 pt-6 pb-3">
              {/* Slider verticale allineato a sinistra, sotto le checkbox */}
              <input
                type="range"
                min={-6}
                max={+6}
                step={1}
                value={orbOffsetDeg}
                onChange={(e) => setOrbOffsetDeg(Number(e.target.value))}
                aria-label="Orb globale (verticale)"
                className="absolute top-0 h-6 rotate-[-90deg] origin-top-left"
                style={{ 
                  left: '12px',
                  top: '500px',
                  width: Math.max(120, sliderLen - 48)
                }}
              />
            </div>

            {/* Descrizione sotto */}
            <div className="mt-2 text-xs text-slate-600">
              <div>
                Orb globale (± gradi): <b>{orbOffsetDeg > 0 ? `+${orbOffsetDeg}°` : `${orbOffsetDeg}°`}</b>
              </div>
            </div>
          </div>

          <div className="flex-1" />
        </aside>

        {/* --- Colonna DESTRA: RUOTA (adattiva) --- */}
        <section className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm md:h-full">
          <div ref={wheelColRef} className="mx-auto w-full h-full">
            <div className="mx-auto" style={{ width: wheelPx, height: wheelPx, maxWidth: '100%' }}>
              <TransitsWheelPro
                natalPoints={natalPoints}
                transitPoints={transitPoints}
                houseCusps={houseCusps}
                enabledAspects={flags}
                orbOffsetDeg={orbOffsetDeg}
                size={wheelPx}
                responsive
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
