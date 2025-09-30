'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SynastryWheelPro, { type PlanetOrAngle, type SAspect, type SAspectType } from '@/components/astro/SynastryWheelPro';

type ChartPoint = {
  name: PlanetOrAngle;
  lon: number;
  retro?: boolean;
  sign?: string | null;
  house?: number | null;
};
type Axes = { asc: number; mc: number };

type AspectRow = {
  p1_owner: 'user'|'person';
  p1_name: string;
  p2_owner: 'user'|'person';
  p2_name: string;
  aspect: SAspectType;
  angle: number | null;
  orb: number | null;
  applying: boolean | null;
  score: number | null;
};

type Flags = {
  conjunction: boolean;
  sextile: boolean;
  square: boolean;
  trine: boolean;
  opposition: boolean;
};

const BASE_ORBS: Record<SAspectType, number> = {
  conjunction: 8,
  sextile: 4,
  square: 6,
  trine: 6,
  opposition: 8,
};

function isPlanetOrAngle(x: string): x is PlanetOrAngle {
  return ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','ASC','MC'].includes(x);
}

export default function SynastryPeopleProClient(props: {
  personId: string;
  chosenSystem: 'placidus'|'whole';
  user: { points: ChartPoint[]; houses?: number[]; axes?: Axes };
  person: { points: ChartPoint[]; houses?: number[]; axes?: Axes };
  aspectsRaw: AspectRow[];
  initialFlags: Flags;
  initialOrbOffset: number;
}) {
  const { personId, chosenSystem, user, person, aspectsRaw, initialFlags, initialOrbOffset } = props;

  const router = useRouter();
  const search = useSearchParams();

  // Stato controlli (client-side → real-time)
  const [flags, setFlags] = React.useState<Flags>(initialFlags);
  const [orbOffset, setOrbOffset] = React.useState<number>(initialOrbOffset);

  // Aggiorna URL (shallow) ad ogni modifica controlli
  React.useEffect(() => {
    const qs = new URLSearchParams(search?.toString() ?? '');
    qs.set('system', chosenSystem);
    qs.set('cj', flags.conjunction ? '1' : '0');
    qs.set('sx', flags.sextile ? '1' : '0');
    qs.set('sq', flags.square ? '1' : '0');
    qs.set('tr', flags.trine ? '1' : '0');
    qs.set('op', flags.opposition ? '1' : '0');
    qs.set('orb', String(orbOffset));
    router.replace(`/lab/people-pro/${personId}?${qs.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flags, orbOffset]);

  // Debounced recompute lato server (opzionale, non blocca la UI)
  React.useEffect(() => {
    const t = setTimeout(() => {
      fetch('/api/synastry/compute?persist=1', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ person_id: personId, enabled: flags, orbOffset }),
      }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [personId, flags, orbOffset]);

  // Filtro realtime client-side
  const enabledSet = React.useMemo(() => new Set<SAspectType>(
    (Object.entries(flags) as Array<[SAspectType, boolean]>).filter(([,v]) => v).map(([k]) => k)
  ), [flags]);

  const aspects: SAspect[] = React.useMemo(() => {
    return aspectsRaw
      .filter(r => isPlanetOrAngle(r.p1_name) && isPlanetOrAngle(r.p2_name))
      .filter(r => enabledSet.has(r.aspect))
      .filter(r => {
        const base = BASE_ORBS[r.aspect] ?? 0;
        const maxOrb = Math.max(0, base + orbOffset);
        const orbVal = Math.abs(Number(r.orb ?? 0));
        return orbVal <= maxOrb;
      })
      .map(r => ({
        a: { owner: r.p1_owner, name: r.p1_name as PlanetOrAngle },
        b: { owner: r.p2_owner, name: r.p2_name as PlanetOrAngle },
        aspect: r.aspect,
        applying: r.applying ?? undefined,
        score: r.score ?? undefined,
      }));
  }, [aspectsRaw, enabledSet, orbOffset]);

  // UI controlli (tipo Transits-Pro) — realtime
  return (
    <div className="px-4 py-6 space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="system" className="text-sm text-gray-700">Sistema case:</label>
          <select
            id="system"
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
            value={chosenSystem}
            onChange={(e) => {
              const qs = new URLSearchParams(search?.toString() ?? '');
              qs.set('system', e.target.value === 'whole' ? 'whole' : 'placidus');
              router.replace(`/lab/people-pro/${personId}?${qs.toString()}`);
            }}
          >
            <option value="placidus">Placidus</option>
            <option value="whole">Whole Sign</option>
          </select>
          <div className="text-xs text-gray-500">
            Mostrando: <b>{chosenSystem === 'placidus' ? 'Placidus' : 'Whole Sign'}</b>
          </div>
        </div>

        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={flags.conjunction}
              onChange={(e) => setFlags(f => ({ ...f, conjunction: e.target.checked }))}
            />
            Conjunction
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={flags.sextile}
              onChange={(e) => setFlags(f => ({ ...f, sextile: e.target.checked }))}
            />
            Sextile
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={flags.square}
              onChange={(e) => setFlags(f => ({ ...f, square: e.target.checked }))}
            />
            Square
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={flags.trine}
              onChange={(e) => setFlags(f => ({ ...f, trine: e.target.checked }))}
            />
            Trine
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={flags.opposition}
              onChange={(e) => setFlags(f => ({ ...f, opposition: e.target.checked }))}
            />
            Opposition
          </label>
        </div>

        <div>
          <div className="mb-1 text-sm text-slate-700">
            Orb globale (± gradi): <b>{orbOffset > 0 ? `+${orbOffset}°` : `${orbOffset}°`}</b>
          </div>
          <input
            type="range"
            min={-6} max={+6} step={1}
            value={orbOffset}
            onChange={(e) => setOrbOffset(Number(e.target.value))}
            className="w-full"
            aria-label="Orb globale"
          />
          <div className="mt-1 text-xs text-slate-500">
            Applica un offset agli orbi base (conj 8°, sext 4°, sq 6°, tr 6°, opp 8°).
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="mx-auto w-full max-w-[860px]">
          <SynastryWheelPro
            user={user}
            person={person}
            aspects={aspects}
            responsive
          />
        </div>
      </div>
    </div>
  );
}