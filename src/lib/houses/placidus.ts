// src/lib/houses/placidus.ts
// Placidus robusto (MIT): ASC/MC via LST (GMST Meeus 12.4), MC risolto numericamente α(λ)=θ,
// cuspidi 12/11/9/8 su arco corto, opposte 6/5/3/2 per +180°, fallback Whole Sign per |lat|>66.5°.

export type PlacidusResult = {
  system: 'placidus';
  cusps: number[]; // [12] in gradi [0,360)
  asc: number;     // [0,360)
  mc: number;      // [0,360)
};

// ---------------------------- util ----------------------------
const TAU = 2 * Math.PI;
const DEG = Math.PI / 180;

const d2r = (d: number) => d * DEG;
const r2d = (r: number) => r / DEG;
const normRad = (x: number) => ((x % TAU) + TAU) % TAU;
const normDeg = (x: number) => ((x % 360) + 360) % 360;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** differenza angolare firmata in radianti, in (-π, +π] */
function angDiff(a: number, b: number): number {
  let d = ((a - b) % TAU + TAU) % TAU;
  if (d > Math.PI) d -= TAU;
  return d;
}

/** percorri l'ARCO PIÙ CORTO da a -> b, parametro t∈[0,1] */
function stepShortest(a: number, b: number, t01: number): number {
  const d = ((b - a + Math.PI) % TAU) - Math.PI; // (-π,π]
  return normRad(a + d * t01);
}

// ----------------------- astronomia di base ----------------------

/** obliquità media (Meeus 22.2) – più che sufficiente per cuspidi/angoli */
function meanObliquityRad(jd: number): number {
  const T = (jd - 2451545.0) / 36525.0;
  const seconds = 21.448 - T * (46.8150 + T * (0.00059 - T * 0.001813));
  const eps0 = 23 + 26 / 60 + (seconds / 3600);
  return d2r(eps0);
}

/** eclittica -> equatoriale (β=0) */
function eclToEq(lambda: number, eps: number): { ra: number; dec: number } {
  const sinλ = Math.sin(lambda);
  const cosλ = Math.cos(lambda);
  const sinE = Math.sin(eps);
  const cosE = Math.cos(eps);

  const sinδ = sinλ * sinE;
  const δ = Math.asin(clamp(sinδ, -1, 1));
  const y = sinλ * cosE;
  const x = cosλ;
  const α = normRad(Math.atan2(y, x));
  return { ra: α, dec: δ };
}

/** RA(λ) per β=0 e sua derivata dα/dλ – utili per Newton */
function raOfLambda(lambda: number, eps: number): number {
  // α = atan2( sinλ cosε, cosλ )
  return normRad(Math.atan2(Math.sin(lambda) * Math.cos(eps), Math.cos(lambda)));
}
function dra_dlambda(lambda: number, eps: number): number {
  // derivata di atan2(y,x) con y=sinλ cosε, x=cosλ:
  // (x*y' - y*x')/(x^2 + y^2) = cosε / (cos^2λ + sin^2λ cos^2ε)
  const sinλ = Math.sin(lambda);
  const cosλ = Math.cos(lambda);
  const cosE = Math.cos(eps);
  const denom = cosλ * cosλ + (sinλ * cosE) * (sinλ * cosE);
  return cosE / denom;
}

/** GMST (Meeus 12.4) in radianti */
function gmstRad(jd: number): number {
  const T = (jd - 2451545.0) / 36525.0;
  const theta = 280.46061837 + 360.98564736629 * (jd - 2451545.0)
            + 0.000387933 * T * T - (T * T * T) / 38710000;
  return d2r(normDeg(theta));
}

/** LST = GMST + longitudine geografica (est +) */
function lstRad(jd: number, lonRad: number): number {
  return normRad(gmstRad(jd) + lonRad);
}

/** semi-arco (H0) per latitudine φ e declinazione δ */
function semiArcRad(phi: number, dec: number): number {
  const X = clamp(-Math.tan(phi) * Math.tan(dec), -1, 1);
  return Math.acos(X); // [0,π]
}

// ---------------------------- angoli principali ----------------------------

/** MC: risolvi numericamente α(λ)=θ (Newton + piccolo fallback) */
function mcLongitudeRad(lst: number, eps: number): number {
  // seed analitico (corretto): λ0 = atan2( sinθ, cosθ cosε )
  let lambda = normRad(Math.atan2(Math.sin(lst), Math.cos(lst) * Math.cos(eps)));

  // Newton – 6 iterazioni bastano largamente (funzione monotona)
  for (let i = 0; i < 6; i++) {
    const f = angDiff(raOfLambda(lambda, eps), lst);
    const df = dra_dlambda(lambda, eps);
    lambda = normRad(lambda - f / df);
  }

  // mini-fallback: rifinisci con due passi di bisezione sull’intorno
  const f0 = (λ: number) => angDiff(raOfLambda(λ, eps), lst);
  const width = d2r(2); // 2°
  const a = normRad(lambda - width); 
  let b = normRad(lambda + width);
  // cammina su arco corto
  for (let i = 0; i < 12; i++) {
    const m = (i + 1) / 12;
    const t = m;
    const fa = f0(stepShortest(a, b, 0));
    const fm = f0(stepShortest(a, b, t));
    if (fa * fm <= 0) { b = stepShortest(a, b, t); break; }
  }
  return lambda;
}

/** Ascendente:
 *  α_ASC = atan2( -cos θ, sin θ * cos ε + tan φ * sin ε )
 *  λ_tmp = ECL(α_ASC) restituisce il DSC; il vero ASC è λ = λ_tmp + π
 */
function ascLongitudeRad(lst: number, lat: number, eps: number): number {
  const sinT = Math.sin(lst);
  const cosT = Math.cos(lst);
  const tanφ = Math.tan(lat);
  const cosE = Math.cos(eps);
  const sinE = Math.sin(eps);

  const y = -cosT;
  const x = sinT * cosE + tanφ * sinE;
  const αasc = Math.atan2(y, x);
  const λtmp = raToLambda(normRad(αasc), eps); // mappa RA→λ in modo coerente
  return normRad(λtmp + Math.PI);
}

/** RA→λ (β=0) coerente con eclToEq: risolve α(λ)=α_target con Newton */
function raToLambda(alpha: number, eps: number): number {
  let λ = normRad(Math.atan2(Math.sin(alpha), Math.cos(alpha) * Math.cos(eps)));
  for (let i = 0; i < 5; i++) {
    const f = angDiff(raOfLambda(λ, eps), alpha);
    const df = dra_dlambda(λ, eps);
    λ = normRad(λ - f / df);
  }
  return λ;
}

// --------------------------- solver su arco corto ---------------------------

/** bisezione robusta sull'ARCO PIÙ CORTO (λA..λB), cercando fn(λ)=0 */
function solveOnShortestArc(
  λA: number,
  λB: number,
  fn: (λ: number) => number,
  maxIter = 50
): number {
  const N = 64; // campionamento per bracketing
  let a = 0, b = 1;
  let fa = fn(stepShortest(λA, λB, a));
  let got = false;

  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const f = fn(stepShortest(λA, λB, t));
    if (fa * f <= 0) { a = (i - 1) / N; b = t; got = true; break; }
    fa = f;
  }
  if (!got) {
    // fallback: punto di minimo |f|
    let bestT = 0, bestAbs = Infinity;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const val = Math.abs(fn(stepShortest(λA, λB, t)));
      if (val < bestAbs) { bestAbs = val; bestT = t; }
    }
    return stepShortest(λA, λB, bestT);
  }

  for (let i = 0; i < maxIter; i++) {
    const m = (a + b) / 2;
    const fm = fn(stepShortest(λA, λB, m));
    if (fa * fm <= 0) {
      b = m;
    } else {
      a = m; fa = fm;
    }
  }
  return stepShortest(λA, λB, (a + b) / 2);
}

// --------------------------- cuspidi Placidus ---------------------------

/** Q1 (ASC→MC), H<0 : α = θ + k·H0  → case 12 (k=2/3), 11 (k=1/3) */
function cuspQ1_between_ASC_MC(
  k: number, θ: number, φ: number, ε: number, λasc: number, λmc: number
): number {
  const f = (λ: number) => {
    const { ra, dec } = eclToEq(λ, ε);
    const H0 = semiArcRad(φ, dec);
    const target = θ + k * H0;        // H negativo: α = θ + k·H0
    return angDiff(ra, target);
  };
  return solveOnShortestArc(λasc, λmc, f);
}

/** Q2 (MC→DSC), H>0 : α = θ - k·H0  → case 9 (k=1/3), 8 (k=2/3) */
function cuspQ2_between_MC_DSC(
  k: number, θ: number, φ: number, ε: number, λmc: number, λdsc: number
): number {
  const f = (λ: number) => {
    const { ra, dec } = eclToEq(λ, ε);
    const H0 = semiArcRad(φ, dec);
    const target = θ - k * H0;        // H positivo: α = θ - k·H0
    return angDiff(ra, target);
  };
  return solveOnShortestArc(λmc, λdsc, f);
}

/** Calcola le cuspidi Placidus. */
export function computePlacidusCusps(
  jdUT: number,
  latDeg: number,
  lonDeg: number,
  _tzMinutes?: number   // mantenuto per compat; non serve al calcolo
): PlacidusResult {
  void _tzMinutes;
  const φ = d2r(latDeg);
  const λgeo = d2r(lonDeg);
  const ε = meanObliquityRad(jdUT);

  // Fallback per lat estreme
  if (Math.abs(latDeg) > 66.5) {
    const θ = lstRad(jdUT, λgeo);
    const λascWS = ascLongitudeRad(θ, φ, ε);
    const λmcWS  = mcLongitudeRad(θ, ε);
    const ascDeg = normDeg(r2d(λascWS));
    const cuspsWS = Array.from({ length: 12 }, (_, i) => normDeg(ascDeg + i * 30));
    return { system: 'placidus', cusps: cuspsWS, asc: ascDeg, mc: normDeg(r2d(λmcWS)) };
  }

  // LST e angoli principali
  const θ = lstRad(jdUT, λgeo);
  const λmc = mcLongitudeRad(θ, ε);           // ora risolto numericamente
  const λasc = ascLongitudeRad(θ, φ, ε);
  const λdsc = normRad(λasc + Math.PI);
  const λic  = normRad(λmc + Math.PI);

  // Cuspidi temporali
  const λ12 = cuspQ1_between_ASC_MC(2 / 3, θ, φ, ε, λasc, λmc);
  const λ11 = cuspQ1_between_ASC_MC(1 / 3, θ, φ, ε, λasc, λmc);
  const λ9  = cuspQ2_between_MC_DSC(1 / 3,  θ, φ, ε, λmc, λdsc);
  const λ8  = cuspQ2_between_MC_DSC(2 / 3,  θ, φ, ε, λmc, λdsc);

  // Opposte
  const λ6 = normRad(λ12 + Math.PI);
  const λ5 = normRad(λ11 + Math.PI);
  const λ3 = normRad(λ9  + Math.PI);
  const λ2 = normRad(λ8  + Math.PI);

  // Ordine 1..12
  const cuspsRad = [λasc, λ2, λ3, λic, λ5, λ6, λdsc, λ8, λ9, λmc, λ11, λ12];
  const cusps = cuspsRad.map(v => normDeg(r2d(v)));

  return { system: 'placidus', cusps, asc: normDeg(r2d(λasc)), mc: normDeg(r2d(λmc)) };
}

/** Assegna la casa (1..12) ad una longitudine λ data la lista di cuspidi 1..12 */
export function assignHouses(longitudeDeg: number, cusps: number[]): number {
  const λ = normDeg(longitudeDeg);
  if (!Array.isArray(cusps) || cusps.length !== 12) return 1;

  // Ordine geometrico CW a partire dalla cuspide 1
  const ordered: number[] = [0];
  for (let step = 0; step < 11; step++) {
    const i = ordered[ordered.length - 1];
    let bestJ = i, bestΔ = 361;
    for (let k = 0; k < 12; k++) {
      if (k === i) continue;
      const d = normDeg(cusps[k] - cusps[i]); // CW in gradi
      if (d > 0 && d < bestΔ) { bestΔ = d; bestJ = k; }
    }
    ordered.push(bestJ);
  }

  // Trova il settore CW [start..end) che contiene λ
  for (let j = 0; j < 12; j++) {
    const i = ordered[j];
    const n = ordered[(j + 1) % 12];
    const start = cusps[i];
    const end = cusps[n];
    const arc = normDeg(end - start);
    const dλ = normDeg(λ - start);
    if (dλ >= 0 && dλ < arc) return j + 1;
  }
  return 12;
}
