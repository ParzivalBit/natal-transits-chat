'use client';
import React from 'react';

export type AspectFlags = {
  conjunction: boolean;
  sextile: boolean;
  square: boolean;
  trine: boolean;
  opposition: boolean;
};
export type SynastryAspectControlsProps = {
  value: AspectFlags;
  orbOffset: number;           // in gradi; es ±0..±6
  onChange: (next: { value: AspectFlags; orbOffset: number }) => void;
  className?: string;
};

export default function SynastryAspectControls({
  value,
  orbOffset,
  onChange,
  className,
}: SynastryAspectControlsProps) {
  const set = (k: keyof AspectFlags) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ value: { ...value, [k]: e.target.checked }, orbOffset });
  const setOrb = (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ value, orbOffset: Number(e.target.value) });

  return (
    <div className={className ?? 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm'}>
      <div className="font-semibold mb-2">Impostazioni aspetti (user ↔ person)</div>

      <div className="flex flex-wrap gap-6 mb-3">
        <label className="flex items-center gap-2"><input type="checkbox" checked={value.conjunction} onChange={set('conjunction')} /> Conjunction</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={value.sextile} onChange={set('sextile')} /> Sextile</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={value.square} onChange={set('square')} /> Square</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={value.trine} onChange={set('trine')} /> Trine</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={value.opposition} onChange={set('opposition')} /> Opposition</label>
      </div>

      <div className="mb-1 text-sm text-slate-700">
        Orb globale (± gradi): <b>{orbOffset > 0 ? `+${orbOffset}°` : `${orbOffset}°`}</b>
      </div>
      <input
        type="range"
        min={-6} max={+6} step={1}
        value={orbOffset}
        onChange={setOrb}
        className="w-full"
        aria-label="Orb globale"
      />
      <div className="mt-1 text-xs text-slate-500">
        Applica un offset agli orbi base (conj 8°, sext 4°, sq 6°, tr 6°, opp 8°).
      </div>
    </div>
  );
}
