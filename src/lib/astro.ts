// src/lib/astro.ts
import { DateTime } from 'luxon';
import * as Astronomy from 'astronomy-engine';

export type BodyName =
  | 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars'
  | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune' | 'Pluto';

export type AngleName = 'ASC' | 'MC';
export type PointName = BodyName | AngleName;

export type Point = {
  name: PointName;
  longitude: number;       // 0..360 eclittica geocentrica
  sign: string;            // Aries..Pisces
  house: number | null;    // 1..12 se noto, altrimenti null
  retro: boolean;          // pianeti; ASC/MC=false
};

export type AspectType =
  | 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';

export type NatalAspect = {
  p1: PointName;
  p2: PointName;
  aspect: AspectType;
  orb: number;        // scarto dall’esatto in °
  strength: number;   // 0..100 circa
};

const OBLIQUITY = (23.4392911 * Math.PI) / 180; // rad, J2000 (ok per MVP)

const SIGN_NAMES = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
] as const;

export function normalizeDeg(x: number): number {
  let d = x % 360;
  if (d < 0) d += 360;
  return d;
}

function rad(d: number): number { return (d * Math.PI) / 180; }
function deg(r: number): number { return (r * 180) / Math.PI; }

export function signFromLongitude(lon: number): string {
  const i = Math.floor(normalizeDeg(lon) / 30) % 12;
  return SIGN_NAMES[i];
}

function eclipticFromEquatorial(eq: Astronomy.EquatorialCoordinates): { elon: number; elat: number } {
  // conversione esplicita (oppure si può usare Astronomy.Ecliptic(eq))
  const ra = eq.ra * 15; // ore → gradi
  const dec = eq.dec;    // gradi
  const raRad = rad(ra);
  const decRad = rad(dec);
  const sinE = Math.sin(OBLIQUITY);
  const cosE = Math.cos(OBLIQUITY);
  const sinDec = Math.sin(decRad);
  const cosDec = Math.cos(decRad);
  const sinRa = Math.sin(raRad);
  const cosRa = Math.cos(raRad);
  const elat = Math.asin(sinDec * cosE - cosDec * sinE * sinRa);
  const y = sinRa * cosE + Math.tan(decRad) * sinE;
  const x = cosRa;
  const elon = Math.atan2(y, x);
  return { elon: normalizeDeg(deg(elon)), elat: deg(elat) };
}

/**
 * Longitudine eclittica geocentrica “of date” senza passare un Observer:
 * usiamo GeoVector (geocentrico) → EquatorFromVector → conversione a eclittiche.
 */
function geocentricEclipticLongitude(body: Astronomy.Body, date: Date): number {
  // true = ofDate vector (correzioni appropriate per l’epoca)
  const vec = Astronomy.GeoVector(body, date, true);
  const eq = Astronomy.EquatorFromVector(vec); // RA/Dec
  const ecl = eclipticFromEquatorial(eq);
  return ecl.elon;
}

function isRetrograde(body: Astronomy.Body, date: Date): boolean {
  const prev = new Date(date.getTime() - 24 * 3600 * 1000);
  const lonNow = geocentricEclipticLongitude(body, date);
  const lonPrev = geocentricEclipticLongitude(body, prev);
  let diff = normalizeDeg(lonNow - lonPrev);
  if (diff > 180) diff -= 360; // -180..+180
  return diff < 0;
}

function localSiderealAngle(date: Date, lonDeg: number): number {
  const gstHours = Astronomy.SiderealTime(date); // ore
  return rad(normalizeDeg(gstHours * 15 + lonDeg)); // rad
}

function ascendantLongitude(date: Date, latDeg: number, lonDeg: number): number {
  const phi = rad(latDeg);
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const theta = localSiderealAngle(date, lonDeg);

  let bestLam = 0;
  let bestScore = 1e12;

  // Più fine ⇒ più preciso sul SEGNO (0.1° ok per MVP)
  const step = 0.1;

  for (let lam = 0; lam < 360; lam += step) {
    const l = rad(lam);

    // β=0 → RA/Dec sull'eclittica
    const sinLam = Math.sin(l);
    const cosLam = Math.cos(l);
    const sinDec = Math.sin(OBLIQUITY) * sinLam;
    const dec = Math.asin(sinDec);
    const ra = Math.atan2(sinLam * Math.cos(OBLIQUITY), cosLam);

    // Angolo orario
    let H = theta - ra;
    H = Math.atan2(Math.sin(H), Math.cos(H)); // normalizza -π..π

    // Alt/Az (convenz. astronomica: 0°=Sud, 90°=Ovest, 180°=Nord, 270°=Est)
    const alt = Math.asin(sinPhi * Math.sin(dec) + cosPhi * Math.cos(dec) * Math.cos(H));
    const az = Math.atan2(
      Math.sin(H),
      Math.cos(H) * sinPhi - Math.tan(dec) * Math.cos(phi)
    );
    const azDeg = normalizeDeg(deg(az));
    const absAlt = Math.abs(deg(alt));

    // Distanza angolare dall'Est (270°), considerando il wrap
    const distEast = Math.min(Math.abs(azDeg - 270), Math.abs(azDeg + 90)); // 270° ≡ -90°

    // Score: vogliamo alt≈0 (orizzonte) E vicino a Est (270°)
    const score = absAlt + 0.05 * distEast;

    if (score < bestScore) {
      bestScore = score;
      bestLam = lam;
    }
  }

  return bestLam; // è già l'Ascendente (scelto a Est)
}


function midheavenLongitude(date: Date, lonDeg: number): number {
  const theta = localSiderealAngle(date, lonDeg);
  const num = Math.sin(theta);
  const den = Math.cos(OBLIQUITY) * Math.cos(theta);
  const lam = Math.atan2(num, den);
  return normalizeDeg(deg(lam));
}

export function computePoints(
  tzName: string | null,
  dateISO: string,            // YYYY-MM-DD
  timeHHMM: string | null,    // HH:MM locale (null => 12:00)
  lat: number | null,
  lon: number | null
): { points: Point[]; houses: boolean; timestampUTC: Date } {
  const localTime = timeHHMM ?? '12:00';
  const dtLocal = DateTime.fromISO(`${dateISO}T${localTime}`, { zone: tzName ?? 'UTC' });
  const dtUtc = dtLocal.toUTC();
  const when = dtUtc.toJSDate();

  const bodies: { name: BodyName; body: Astronomy.Body }[] = [
    { name: 'Sun', body: Astronomy.Body.Sun },
    { name: 'Moon', body: Astronomy.Body.Moon },
    { name: 'Mercury', body: Astronomy.Body.Mercury },
    { name: 'Venus', body: Astronomy.Body.Venus },
    { name: 'Mars', body: Astronomy.Body.Mars },
    { name: 'Jupiter', body: Astronomy.Body.Jupiter },
    { name: 'Saturn', body: Astronomy.Body.Saturn },
    { name: 'Uranus', body: Astronomy.Body.Uranus },
    { name: 'Neptune', body: Astronomy.Body.Neptune },
    { name: 'Pluto', body: Astronomy.Body.Pluto }
  ];

  const planetPoints: Point[] = bodies.map(({ name, body }) => {
    const lonEcl = geocentricEclipticLongitude(body, when);
    const retro = isRetrograde(body, when);
    return {
      name,
      longitude: lonEcl,
      sign: signFromLongitude(lonEcl),
      house: null,
      retro
    };
  });

  let asc: Point | null = null;
  let mc: Point | null = null;
  let haveHouses = false;

  if (timeHHMM && lat != null && lon != null) {
    const λasc = ascendantLongitude(when, lat, lon);
    const λmc  = midheavenLongitude(when, lon);
    const ascSign = signFromLongitude(λasc);

    asc = { name: 'ASC', longitude: λasc, sign: ascSign, house: 1, retro: false };
    mc  = { name: 'MC',  longitude: λmc,  sign: signFromLongitude(λmc), house: null, retro: false };

    const ascIndex = Math.floor(normalizeDeg(λasc) / 30);
    for (const p of planetPoints) {
      const pIndex = Math.floor(normalizeDeg(p.longitude) / 30);
      const diff = (pIndex - ascIndex + 12) % 12;
      p.house = diff + 1;
    }
    haveHouses = true;
  }

  const allPoints = asc && mc ? [...planetPoints, asc, mc] : planetPoints;
  return { points: allPoints, houses: haveHouses, timestampUTC: when };
}

// ──────────────────────────────── Aspetti ────────────────────────────────────

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

function orbMax(p1: PointName, p2: PointName): number {
  const c1 = classOfPoint(p1);
  const c2 = classOfPoint(p2);
  if (c1 === 'lum' || c2 === 'lum') return 6;
  if (c1 === 'pers' || c2 === 'pers' || c1 === 'ang' || c2 === 'ang') return 5;
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

function pointWeight(p: PointName): number {
  switch (classOfPoint(p)) {
    case 'lum': return 1.00;
    case 'ang': return 0.95;
    case 'pers': return 0.90;
    case 'soc': return 0.80;
    case 'out': return 0.70;
  }
}

export function computeNatalAspects(points: Point[]): NatalAspect[] {
  const res: NatalAspect[] = [];
  const targets: AspectType[] = ['conjunction', 'sextile', 'square', 'trine', 'opposition'];

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const A = points[i];
      const B = points[j];
      const d = minAngle(A.longitude, B.longitude);

      let best: { type: AspectType; diff: number } | null = null;
      for (const t of targets) {
        const target = ASPECT_DEGREES[t];
        const diff = Math.abs(d - target);
        if (best === null || diff < best.diff) best = { type: t, diff };
      }
      if (!best) continue;

      const maxOrb = orbMax(A.name, B.name);
      if (best.diff <= maxOrb) {
        const aw = aspectWeight(best.type);
        const pw = pointWeight(A.name) * pointWeight(B.name);
        const tightness = 1 - best.diff / maxOrb;
        const strength = Math.round(100 * aw * pw * (0.6 + 0.4 * tightness));
        res.push({
          p1: A.name,
          p2: B.name,
          aspect: best.type,
          orb: parseFloat(best.diff.toFixed(2)),
          strength
        });
      }
    }
  }
  return res;
}
