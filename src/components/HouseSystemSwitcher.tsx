// src/components/HouseSystemSwitcher.tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type HouseSystem = 'placidus' | 'whole';

type Props = {
  current: HouseSystem;
  size?: 'sm' | 'md';
  className?: string;
};

export default function HouseSystemSwitcher({ current, size = 'md', className }: Props) {
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState<HouseSystem>(current);
  const router = useRouter();

  const sizeClass = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm';

  const btnBase =
    `rounded-md border ${sizeClass} transition-colors disabled:opacity-60 disabled:cursor-not-allowed`;
  const btnActive = 'bg-blue-600 text-white border-blue-600';
  const btnIdle = 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50';

  async function apply(system: HouseSystem) {
    if (system === local || pending) return;
    setLocal(system);

    try {
      const res = await fetch(`/api/chart/compute?system=${system}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source: 'HouseSystemSwitcher' }),
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('compute error', res.status, json);
        alert('Errore nel ricalcolo. Riprova.');
        return;
      }
      if (json?.fallbackApplied) {
        alert('Placidus non disponibile alla latitudine indicata: attivato il fallback Whole Sign.');
      }
    } catch (err) {
      console.error(err);
      alert('Errore di rete durante il ricalcolo.');
    } finally {
      startTransition(() => {
        router.refresh();
      });
    }
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <span className="text-xs text-gray-500">House system:</span>
      <div className="inline-flex gap-1" aria-busy={pending}>
        <button
          type="button"
          className={`${btnBase} ${local === 'whole' ? btnActive : btnIdle}`}
          onClick={() => apply('whole')}
          disabled={pending}
          aria-pressed={local === 'whole'}
        >
          Whole
        </button>
        <button
          type="button"
          className={`${btnBase} ${local === 'placidus' ? btnActive : btnIdle}`}
          onClick={() => apply('placidus')}
          disabled={pending}
          aria-pressed={local === 'placidus'}
        >
          Placidus
        </button>
      </div>
    </div>
  );
}
