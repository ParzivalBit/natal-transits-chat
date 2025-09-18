// src/lib/transits.ts
import * as Astronomy from 'astronomy-engine';
import {
  type BodyName,
  type PointName,
  type AspectType,
  normalizeDeg,
} from '@/lib/astro';

export type TransitLongitude = {
  name: BodyName;
  longitude: number; // 0..360
};

export type NatalPointLite = {
  name: PointName;
  longitude: number;
};

export type TransitEventCalc = {
  date: string;         // YYYY-MM-DD (UTC day)
  t_planet: BodyName;   // transiting planet
  n_point: PointName;   // natal planet/angle
  aspect: AspectType;   // conj/sxt/sqr/trn/opp
  orb: number;          // degrees (0..maxOrb)
  score: number;        // 0..1
};

const TRANSIT_PLANETS: BodyName[] = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
  'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
];

const BODY_ENUM: Record<BodyName, Astronomy.Body> = {
  Sun: Astronomy.Body.Sun,
  Moon: Astronomy.Body.Moon,
  Mercury: Astronomy.Body.Mercury,
  Venus: Astronomy.Body.Venus,
  Mars: Astronomy.Body.Mars,
  Jupiter: Astronomy.Body.Jupiter,
  Saturn: Astronomy.Body.Saturn,
  Uranus: Astronomy.Body.Uranus,
  Neptune: Astronomy.Body.Neptune,
  Pluto: Astronomy.Body.Pluto,
};

function rad(d: number): number { return (d * Math.PI) / 180; }
function deg(r: number): number { return (r * 180) / Math.PI; }

const OBLIQUITY = (23.4392911 * Math.PI) / 180;

function eclipticFromEquatorial(eq: Astronomy.EquatorialCoordinates): { elon: number } {
  // RA in ore → gradi
  const raDeg = eq.ra * 15;
  const decDeg = eq.dec;
  const ra = rad(raDeg);
  const dec = rad(decDeg);
  const sinE = Math.sin(OBLIQUITY);
  const cosE = Math.cos(OBLIQUITY);
  const sinRa = Math.sin(ra);
  const cosRa = Math.cos(ra);
  const y = sinRa * cosE + Math.tan(dec) * sinE;
  const x = cosRa;
  const elon = Math.atan2(y, x);
  return { elon: normalizeDeg(deg(elon)) };
}

function geocentricEclLongitude(body: Astronomy.Body, when: Date): number {
  const vec = Astronomy.GeoVector(body, when, true);
  const eq  = Astronomy.EquatorFromVector(vec);
  return eclipticFromEquatorial(eq).elon;
}

export function utNoon(dateIso: string): Date {
  const [y, m, d] = dateIso.split('-').map((s) => Number(s));
  return new Date(Date.UTC(y, (m - 1), d, 12, 0, 0)); // 12:00 UTC
}

export function computeTransitingLongitudes(dateIso: string): TransitLongitude[] {
  const when = utNoon(dateIso);
  return TRANSIT_PLANETS.map((p) => ({
    name: p,
    longitude: geocentricEclLongitude(BODY_ENUM[p], when),
  }));
}

const ASPECT_DEGREES: Record<AspectType, number> = {
  conjunction: 0,
  sextile: 60,
  square: 90,
  trine: 120,
  opposition: 180,
};

function minAngle(a: number, b: number): number {
  let d = Math.abs(normalizeDeg(a - b));
  if (d > 180) d = 360 - d;
  return d;
}

function classOfPoint(name: PointName): 'lum' | 'pers' | 'soc' | 'out' | 'ang' {
  if (name === 'Sun' || name === 'Moon') return 'lum';
  if (name === 'Mercury' || name === 'Venus' || name === 'Mars') return 'pers';
  if (name === 'Jupiter' || name === 'Saturn') return 'soc';
  if (name === 'Uranus' || name === 'Neptune' || name === 'Pluto') return 'out';
  return 'ang';
}

// MVP guideline orbs: 6° luminari, 5° personali/angoli, 3° lenti
export function maxOrbForPair(transiting: BodyName, natal: PointName): number {
  const cT = classOfPoint(transiting);
  const cN = classOfPoint(natal);
  if (cT === 'lum' || cN === 'lum') return 6;
  if (cT === 'pers' || cN === 'pers' || cN === 'ang') return 5;
  return 3;
}

function aspectWeight(a: AspectType): number {
  switch (a) {
    case 'conjunction': return 1.00;
    case 'opposition':  return 0.95;
    case 'trine':       return 0.90;
    case 'square':      return 0.85;
    case 'sextile':     return 0.75;
  }
}

function transitPlanetWeight(p: BodyName): number {
  switch (classOfPoint(p)) {
    case 'lum': return 0.85;  // per non far dominare la Luna
    case 'pers': return 0.90;
    case 'soc': return 0.95;
    case 'out': return 1.00;  // lenti più “pesanti”
    case 'ang': return 0.95;
  }
}

function natalPointWeight(p: PointName): number {
  switch (classOfPoint(p)) {
    case 'lum': return 1.00;
    case 'ang': return 0.95;
    case 'pers': return 0.90;
    case 'soc': return 0.80;
    case 'out': return 0.70;
  }
}

export function computeTransitEventsForDay(
  dateIso: string,
  transits: TransitLongitude[],
  natalPoints: NatalPointLite[]
): TransitEventCalc[] {
  const events: TransitEventCalc[] = [];
  const aspects: AspectType[] = ['conjunction', 'sextile', 'square', 'trine', 'opposition'];

  for (const t of transits) {
    for (const n of natalPoints) {
      const d = minAngle(t.longitude, n.longitude);
      // aspetto più vicino
      let best: { a: AspectType; diff: number } | null = null;
      for (const a of aspects) {
        const ad = ASPECT_DEGREES[a];
        const diff = Math.abs(d - ad);
        if (best === null || diff < best.diff) best = { a, diff };
      }
      if (!best) continue;

      const maxOrb = maxOrbForPair(t.name, n.name);
      if (best.diff <= maxOrb) {
        const score =
          aspectWeight(best.a) *
          transitPlanetWeight(t.name) *
          natalPointWeight(n.name);

        events.push({
          date: dateIso,
          t_planet: t.name,
          n_point: n.name,
          aspect: best.a,
          orb: Number(best.diff.toFixed(2)),
          score: Number(score.toFixed(3)),
        });
      }
    }
  }

  // ordina per score desc, poi orb asc
  events.sort((A, B) => (B.score - A.score) || (A.orb - B.orb));
  return events;
}
