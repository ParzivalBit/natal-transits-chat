// src/lib/planets/runtime.ts
import { Body, AstroTime, GeoVector, Ecliptic } from 'astronomy-engine';

export type RuntimePointName =
  | 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars'
  | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune' | 'Pluto';

export type RuntimePoint = {
  name: RuntimePointName;
  longitude: number; // gradi 0..360
  sign: string;      // "Aries", ...
  retro: boolean;
};

const BODY_MAP: { name: RuntimePointName; body: Body }[] = [
  { name: 'Sun',     body: Body.Sun },
  { name: 'Moon',    body: Body.Moon },
  { name: 'Mercury', body: Body.Mercury },
  { name: 'Venus',   body: Body.Venus },
  { name: 'Mars',    body: Body.Mars },
  { name: 'Jupiter', body: Body.Jupiter },
  { name: 'Saturn',  body: Body.Saturn },
  { name: 'Uranus',  body: Body.Uranus },
  { name: 'Neptune', body: Body.Neptune },
  { name: 'Pluto',   body: Body.Pluto },
];

function normDeg(x: number): number { return ((x % 360) + 360) % 360; }

function signedDeltaDeg(a: number, b: number): number {
  // ritorna a-b in (-180, +180]
  let d = a - b;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

function signFromLongitude(lon: number): string {
  const SIGNS = [
    'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'
  ];
  const idx = Math.floor(normDeg(lon) / 30) % 12;
  return SIGNS[idx];
}

/** Calcola i pianeti per una certa data UTC (geocentric, ecliptic of-date). */
export function computeDailyPlanets(dateUTC: Date): RuntimePoint[] {
  const tNow  = new AstroTime(dateUTC);
  const tPrev = new AstroTime(new Date(dateUTC.getTime() - 86400000)); // -1 giorno

  return BODY_MAP.map(({ name, body }): RuntimePoint => {
    const vNow  = GeoVector(body, tNow, /*aberration*/ true);
    const eNow  = Ecliptic(vNow); // {elon, elat, dist}
    const lonNow = normDeg(eNow.elon);

    const vPrev  = GeoVector(body, tPrev, true);
    const ePrev  = Ecliptic(vPrev);
    const lonPrev = normDeg(ePrev.elon);

    const retro = signedDeltaDeg(lonNow, lonPrev) < 0;

    return {
      name,
      longitude: lonNow,
      sign: signFromLongitude(lonNow),
      retro,
    };
  });
}

export function computePlanetsAtUTC(dateUTC: Date): RuntimePoint[] {
  return computeDailyPlanets(dateUTC);
}

// --- add aliases/types for consumers ---
export type RuntimePlanet = { name: string; longitude: number; retro?: boolean };