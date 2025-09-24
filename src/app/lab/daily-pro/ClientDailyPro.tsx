// FILE: src/app/lab/daily-pro/ClientDailyPro.tsx
"use client";

import React, { useState } from "react";
import DailySkyWheelPro, {
  type ProPoint,
  type AspectType,
} from "@/components/astro/DailySkyWheelPro";

function Controls({
  enabledAspects,
  setEnabledAspects,
  orbOffsetDeg,
  setOrbOffsetDeg,
}: {
  enabledAspects: Record<AspectType, boolean>;
  setEnabledAspects: (val: Record<AspectType, boolean>) => void;
  orbOffsetDeg: number;
  setOrbOffsetDeg: (v: number) => void;
}) {
  const toggle = (k: AspectType) =>
    setEnabledAspects({ ...enabledAspects, [k]: !enabledAspects[k] });

  return (
    <div className="mb-4 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 text-sm shadow-sm">
      <div className="font-medium text-gray-800">Impostazioni aspetti</div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(["conjunction", "sextile", "square", "trine", "opposition"] as AspectType[]).map(
          (t) => (
            <label key={t} className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-gray-900"
                checked={enabledAspects[t]}
                onChange={() => toggle(t)}
              />
              <span className="capitalize">{t}</span>
            </label>
          )
        )}
      </div>

      <div className="mt-2">
        <label htmlFor="orb" className="mb-1 block text-gray-700">
          Orb globale (± gradi):{" "}
          <span className="font-semibold">
            {orbOffsetDeg >= 0 ? `+${orbOffsetDeg}` : orbOffsetDeg}°
          </span>
        </label>
        <input
          id="orb"
          type="range"
          min={-4}
          max={6}
          step={1}
          value={orbOffsetDeg}
          onChange={(e) => setOrbOffsetDeg(Number(e.target.value))}
          className="w-full"
        />
        <p className="mt-1 text-xs text-gray-500">
          Applica un offset agli orbi base (conj 8°, sext 4°, sq 6°, tr 6°, opp 8°).
        </p>
      </div>
    </div>
  );
}

export default function ClientDailyPro({ today }: { today: ProPoint[] }) {
  const [enabledAspects, setEnabledAspects] = useState<Record<AspectType, boolean>>({
    conjunction: true,
    sextile: true,
    square: true,
    trine: true,
    opposition: true,
  });
  const [orbOffsetDeg, setOrbOffsetDeg] = useState<number>(0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Daily Sky — Pro</h1>
        <p className="text-sm text-gray-500">
          Cielo del giorno: pianeti in transito e aspetti (toggle + orb come in transits-pro).
        </p>
      </div>

      {/* Controls */}
      <Controls
        enabledAspects={enabledAspects}
        setEnabledAspects={setEnabledAspects}
        orbOffsetDeg={orbOffsetDeg}
        setOrbOffsetDeg={setOrbOffsetDeg}
      />

      {/* Wheel */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="aspect-square w-full max-w-[720px] mx-auto">
          <DailySkyWheelPro
            today={today}
            enabledAspects={enabledAspects}
            orbOffsetDeg={orbOffsetDeg}
            responsive
          />
        </div>
      </div>
    </div>
  );
}
