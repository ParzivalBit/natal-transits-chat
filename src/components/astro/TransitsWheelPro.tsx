"use client";

import React, { useMemo, useState, useId, useCallback } from "react";
import { polarToXY } from "@/lib/graphics/polar";
import {
  planetChar,
  signChar,
  signColor,
  aspectColor,
  type PlanetName,
  type ZodiacSign,
} from "@/lib/graphics/glyphs";

export type ProPoint = {
  id: string;
  name: string;
  lonDeg: number;
  kind: "natal" | "transit";
  retro?: boolean;
  sign?: string | null;
};

export type AspectType = "conjunction" | "sextile" | "square" | "trine" | "opposition";

export type InterAspect = {
  id: string;
  a: { id: string; lon: number };
  b: { id: string; lon: number };
  type: AspectType;
  exactAngle: number;
  delta: number;
  strength: number;
};

const STROKES = {
  ringThin: 0.22,
  ringMid: 0.28,
  ringBold: 0.9,
  aspects: 0.35,
  aspectsHi: 1.0,
  planetHalo: 0.35,
  planetHaloHi: 1.0,
};

const ASPECTS_MAP: Record<AspectType, number> = {
  conjunction: 0,
  sextile: 60,
  square: 90,
  trine: 120,
  opposition: 180,
};

const ORBS_BASE: Record<AspectType, number> = {
  conjunction: 8,
  sextile: 4,
  square: 6,
  trine: 6,
  opposition: 8,
};

const TRANSIT_GLYPH_COLOR = "#ea580c"; // orange-600
const NATAL_GLYPH_COLOR = "#0284c7";   // sky-600
const TRANSIT_TICK_COLOR = TRANSIT_GLYPH_COLOR;
const NATAL_TICK_COLOR = NATAL_GLYPH_COLOR;

const BLOCKED_POINTS = new Set([
  "ASC","AC","Asc","Ascendant","MC","Midheaven","IC","DSC","DC","Desc","Descendant","Vertex","Lilith","Fortuna","?"
]);

function norm360(d: number) { return ((d % 360) + 360) % 360; }
function angularDistance(a: number, b: number) { let d = Math.abs(a - b) % 360; if (d > 180) d = 360 - d; return d; }
function midAngle(a: number, b: number) { const A = norm360(a); const B = norm360(b); const d = ((B - A + 360) % 360); return norm360(A + d / 2); }
function normSigned(d: number) {
  const x = ((d + 180) % 360 + 360) % 360 - 180;
  return x;
} // [-180..+180] con segno (utile per piccoli delta di frame)
function signFromLongitude(longitude: number): ZodiacSign {
  const idx = Math.floor(norm360(longitude) / 30);
  return ([
    "Aries","Taurus","Gemini","Cancer","Leo","Virgo",
    "Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces",
  ] as ZodiacSign[])[idx]!;
}

function PlanetGlyph({ name, size, fill = "currentColor" }: { name: string; size: number; fill?: string }) {
  const g = planetChar(name as PlanetName) ?? "•";
  return (
    <text x={0} y={0} fontSize={size} textAnchor="middle" dominantBaseline="middle"
      aria-label={name} fill={fill}
      fontFamily='"Noto Sans Symbols 2","Segoe UI Symbol","Apple Symbols","DejaVu Sans",sans-serif'>
      {g}
    </text>
  );
}
function SignGlyph({ sign, size }: { sign: ZodiacSign; size: number }) {
  const g = signChar(sign), c = signColor(sign);
  return (
    <text x={0} y={0} fontSize={size} textAnchor="middle" dominantBaseline="middle"
      aria-label={sign} fill={c}
      fontFamily='"Noto Sans Symbols 2","Segoe UI Symbol","Apple Symbols","DejaVu Sans",sans-serif'>
      {g}
    </text>
  );
}

export type TransitsWheelProProps = {
  transitPoints: ProPoint[];
  natalPoints: ProPoint[];
  /** 12 cuspidi (gradi eclittici) del tema natale */
  houseCusps?: number[];
  enabledAspects?: Partial<Record<AspectType, boolean>>;
  /** offset sugli orbi base (può essere negativo) */
  orbOffsetDeg?: number;
  /** lunghezza tacche dei pianeti (px) */
  planetTickLen?: number;
  /** offset radiale glifi (px, + = verso centro) */
  userGlyphOffset?: number;
  /** ruota SOLO la corona zodiacale rispetto ad assi/case/pianeti */
  zodiacExtraRotationDeg?: number; // default 0
  size?: number;
  className?: string;
  responsive?: boolean;
};

const CX = 260;
const CY = 260;

export default function TransitsWheelPro({
  transitPoints,
  natalPoints,
  houseCusps,
  enabledAspects,
  orbOffsetDeg = 0,
  planetTickLen = 12,
  userGlyphOffset = 10,
  zodiacExtraRotationDeg = 0,
  size = 520,
  className,
  responsive = true,
}: TransitsWheelProProps) {
  const uid = useId();

  // Geometrie (estetica originale)
  const R_ZOD_OUT = 230, R_ZOD_IN = 200;
  const R_NATAL = 190, R_TRANSIT = 170;
  const R_ASPECT = 100;
  const HOUSE_NUM_BAND_W = 20;
  const R_HOUSE_NUM_IN = R_ASPECT, R_HOUSE_NUM_OUT = R_ASPECT + HOUSE_NUM_BAND_W;
  const R_HOUSE_NUM_MID = (R_HOUSE_NUM_IN + R_HOUSE_NUM_OUT) / 2;
  const HOUSE_NUM_FONT = 11, HOUSE_NUM_TICK_W = 1.2;

  const PLANET_TICK_OPACITY = 0.5, PLANET_TICK_WIDTH = 1.2;

  const AXIS_LABEL_RADIUS_BASE = R_ZOD_OUT + 18;
  const AXIS_TICK_OUT_LEN = 10;
  const AXIS_LABEL_FONT = 11.5;
  const AXIS_COLOR = "#111827";

  const [hoverPlanetId, setHoverPlanetId] = useState<string | null>(null);
  const [hoverAspectId, setHoverAspectId] = useState<string | null>(null);

  // Normalizzazione punti
  const natalFiltered = useMemo(
    () => (natalPoints ?? [])
      .filter(p => p.kind === "natal" && !BLOCKED_POINTS.has(p.name))
      .map(p => ({ ...p, lon: norm360(p.lonDeg) })),
    [natalPoints]
  );
  const today = useMemo(
    () => (transitPoints ?? [])
      .filter(p => p.kind === "transit" && !BLOCKED_POINTS.has(p.name))
      .map(p => ({ ...p, lon: norm360(p.lonDeg) })),
    [transitPoints]
  );

  // ---------- HANDNESS & ASC (dinamico) ----------
  const cuspsRaw = useMemo(() => (houseCusps ?? []).map(norm360), [houseCusps]);

  const ascFallback = cuspsRaw.length ? cuspsRaw[0]! : 0;
  const applyRot = useCallback((theta: number, ascRef: number = ascFallback) => {
    // proiezione schermo: ASC → 270°, verso orario
    return norm360(ascRef + 270 - theta);
  }, [ascFallback]);

  const rotatedCusps = useMemo(
    () => cuspsRaw.map(c => applyRot(c, ascFallback)),
    [cuspsRaw, applyRot, ascFallback]
  );

  const nearestIdxTo = useCallback((targetDeg: number) => {
    if (!rotatedCusps.length) return 0;
    let best = 0, bestD = 1e9;
    for (let i = 0; i < rotatedCusps.length; i++) {
      const d = angularDistance(rotatedCusps[i]!, targetDeg);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }, [rotatedCusps]);

  const idxASC = nearestIdxTo(270);
  const idxDC  = nearestIdxTo(90);
  const idxMC  = nearestIdxTo(0);
  const idxIC  = nearestIdxTo(180);
  // ---- Delta di frame tra case/assi e zodiaco/pianeti ----
// MC sullo schermo dovrebbe cadere esattamente a 0° (alto).
// Se non succede, misuriamo lo scostamento residuo (mcScreen)
// e lo useremo per ruotare zodiaco + pianeti insieme.
const mcScreen = applyRot(cuspsRaw[idxMC] ?? 0, ascFallback); // 0°=alto nel nostro canvas
const frameDeltaFromMC = normSigned(mcScreen); // se MC è a +10°, delta=+10 -> andrà sottratto a zodiaco+pianeti

// Possibile fine-tuning manuale già previsto
const zShiftTotal = normSigned((zodiacExtraRotationDeg ?? 0) + frameDeltaFromMC);


  const ascTrue = cuspsRaw[idxASC] ?? ascFallback;
  const applyRotTrue = useCallback((theta: number) => applyRot(theta, ascTrue), [applyRot, ascTrue]);

  const cuspsFromAsc = useMemo(() => {
    if (!cuspsRaw.length) return [] as number[];
    const out: number[] = [];
    for (let k = 0; k < 12; k++) out.push(cuspsRaw[(idxASC + k) % 12]!);
    return out;
  }, [cuspsRaw, idxASC]);

  // ---------- Pianeti proiettati ----------
  const natalPlanets = useMemo(() => {
    const Rg = R_NATAL - userGlyphOffset;
    return natalFiltered.map(p => {
      const theta = applyRotTrue(p.lon - zShiftTotal);
      const posNat = polarToXY(CX, CY, Rg, theta);
      const posAsp = polarToXY(CX, CY, R_ASPECT, theta);
      return {
        ...p,
        nsId: `n:${p.id}`,
        theta, x: posNat.x, y: posNat.y, ax: posAsp.x, ay: posAsp.y,
        signZ: signFromLongitude(p.lon), band: "natal" as const
      };
    });
  }, [userGlyphOffset, natalFiltered, applyRotTrue, zShiftTotal]);

  const transitPlanets = useMemo(() => {
    const Rg = R_TRANSIT - userGlyphOffset;
    return today.map(p => {
      const theta = applyRotTrue(p.lon - zShiftTotal);
      const posTr = polarToXY(CX, CY, Rg, theta);
      const posAsp = polarToXY(CX, CY, R_ASPECT, theta);
      return {
        ...p,
        nsId: `t:${p.id}`,
        theta, x: posTr.x, y: posTr.y, ax: posAsp.x, ay: posAsp.y,
        signZ: signFromLongitude(p.lon), band: "transit" as const
      };
    });
  }, [userGlyphOffset, today, applyRotTrue, zShiftTotal]);

  // ---------- Aspetti ----------
  const enabled: Record<AspectType, boolean> = useMemo(() => {
    const allTrue: Record<AspectType, boolean> = {
      conjunction: true, sextile: true, square: true, trine: true, opposition: true,
    };
    return { ...allTrue, ...(enabledAspects ?? {}) };
  }, [enabledAspects]);

  const ORBS: Record<AspectType, number> = useMemo(() => {
    const clamp = (v: number) => Math.max(0, v);
    return {
      conjunction: clamp(ORBS_BASE.conjunction + orbOffsetDeg),
      sextile:     clamp(ORBS_BASE.sextile     + orbOffsetDeg),
      square:      clamp(ORBS_BASE.square      + orbOffsetDeg),
      trine:       clamp(ORBS_BASE.trine       + orbOffsetDeg),
      opposition:  clamp(ORBS_BASE.opposition  + orbOffsetDeg),
    };
  }, [orbOffsetDeg]);

  type BestMatch = { t: AspectType; exact: number; delta: number; strength: number };
  const aspects = useMemo<InterAspect[]>(() => {
    const out: InterAspect[] = [];
    for (const a of natalFiltered) {
      for (const b of today) {
        const d = angularDistance(a.lon, b.lon);
        let best: BestMatch | undefined;
        (Object.keys(ASPECTS_MAP) as AspectType[]).forEach((t) => {
          if (!enabled[t]) return;
          const exact = ASPECTS_MAP[t], orb = ORBS[t];
          const delta = Math.abs(d - exact);
          if (delta <= orb) {
            const strength = orb === 0 ? 0 : 1 - delta / orb;
            if (!best || delta < best.delta) best = { t, exact, delta, strength };
          }
        });
        if (best) {
          out.push({
            id: `${a.id}-${b.id}-${best.t}`,
            a: { id: `n:${a.id}`, lon: a.lon },
            b: { id: `t:${b.id}`, lon: b.lon },
            type: best.t, exactAngle: best.exact, delta: best.delta, strength: best.strength,
          });
        }
      }
    }
    return out;
  }, [natalFiltered, today, enabled, ORBS]);

  const involvedAspects = useMemo(() => {
    if (hoverPlanetId)
      return new Set(aspects.filter(x => x.a.id === hoverPlanetId || x.b.id === hoverPlanetId).map(x => x.id));
    if (hoverAspectId) return new Set([hoverAspectId]);
    return new Set<string>();
  }, [hoverPlanetId, hoverAspectId, aspects]);

  const involvedPlanets = useMemo(() => {
    if (hoverPlanetId) {
      const ids = aspects.filter(x => x.a.id === hoverPlanetId || x.b.id === hoverPlanetId).flatMap(x => [x.a.id, x.b.id]);
      return new Set<string>([hoverPlanetId, ...ids]);
    }
    if (hoverAspectId) {
      const a = aspects.find(x => x.id === hoverAspectId);
      if (a) return new Set<string>([a.a.id, a.b.id]);
    }
    return new Set<string>();
  }, [hoverPlanetId, hoverAspectId, aspects]);

  // ---------- Zodiac band (ruotabile indipendentemente) ----------
  const zodiacMarks = useMemo(() => {
    //const delta = zodiacExtraRotationDeg; // ruota SOLO la corona dei segni
    const out: { sign: ZodiacSign; mid: number; tx1:number;ty1:number;tx2:number;ty2:number; gx:number;gy:number }[] = [];
    for (let i = 0; i < 12; i++) {
      const sign = ([
        "Aries","Taurus","Gemini","Cancer","Leo","Virgo",
        "Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces",
      ] as ZodiacSign[])[i]!;
      const start = applyRotTrue(i * 30 - zShiftTotal);
      const mid   = applyRotTrue(i * 30 + 15 - zShiftTotal);
      const t1 = polarToXY(CX, CY, R_ZOD_OUT, start);
      const t2 = polarToXY(CX, CY, R_ZOD_IN, start);
      const g  = polarToXY(CX, CY, (R_ZOD_OUT + R_ZOD_IN) / 2, mid);
      out.push({ sign, mid, tx1: t1.x, ty1: t1.y, tx2: t2.x, ty2: t2.y, gx: g.x, gy: g.y });
    }
    return out;
  }, [applyRotTrue, zShiftTotal]);

  // ---------- Case & numeri (partendo dall’ASC vero) ----------
  const houseLines = useMemo(() => {
    if (cuspsFromAsc.length < 12) return [];
    return cuspsFromAsc.map((deg, k) => {
      const theta = applyRotTrue(deg);
      const { x, y } = polarToXY(CX, CY, R_ZOD_OUT, theta);
      const isAxis =
        angularDistance(theta, 270) < 2 ||
        angularDistance(theta,   0) < 2 ||
        angularDistance(theta,  90) < 2 ||
        angularDistance(theta, 180) < 2;
      return { i: k, theta, x, y, isAxis };
    });
  }, [cuspsFromAsc, applyRotTrue]);

  const houseNumbers = useMemo(() => {
    if (cuspsFromAsc.length < 12) return [];
    const out: { n: number; theta: number; x: number; y: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const a = cuspsFromAsc[i]!;
      const b = cuspsFromAsc[(i + 1) % 12]!;
      const m = applyRotTrue(midAngle(a, b));
      const pos = polarToXY(CX, CY, R_HOUSE_NUM_MID, m);
      out.push({ n: i + 1, theta: m, x: pos.x, y: pos.y });
    }
    return out;
  }, [cuspsFromAsc, R_HOUSE_NUM_MID, applyRotTrue]);

  const axisLabels = useMemo(() => {
    if (!cuspsRaw.length) return [];
    const build = (key: "AC"|"DC"|"MC"|"IC", rawDeg: number) => {
      const theta = applyRotTrue(rawDeg);
      const tickOuter = polarToXY(CX, CY, R_ZOD_OUT + AXIS_TICK_OUT_LEN, theta);
      const tickInner = polarToXY(CX, CY, R_ZOD_OUT, theta);
      const labelPos  = polarToXY(CX, CY, AXIS_LABEL_RADIUS_BASE, theta);
      return { key, theta,
        tx1: tickInner.x, ty1: tickInner.y,
        tx2: tickOuter.x, ty2: tickOuter.y,
        lx: labelPos.x, ly: labelPos.y };
    };
    return [
      build("AC", cuspsRaw[idxASC]!),
      build("DC", cuspsRaw[idxDC]!),
      build("MC", cuspsRaw[idxMC]!),
      build("IC", cuspsRaw[idxIC]!),
    ];
  }, [cuspsRaw, idxASC, idxDC, idxMC, idxIC, AXIS_LABEL_RADIUS_BASE, applyRotTrue]);

  // ---------- Render ----------
  return (
    <div className={className}>
      <svg width={responsive ? "100%" : size} height={responsive ? "100%" : size}
        viewBox="0 0 520 520" role="img" aria-label="Transits Pro Wheel">
        {/* Fascia segni */}
        <circle cx={CX} cy={CY} r={R_ZOD_OUT} fill="none" stroke="currentColor" strokeOpacity={STROKES.ringBold} strokeWidth={2.1}/>
        <circle cx={CX} cy={CY} r={R_ZOD_IN}  fill="none" stroke="currentColor" strokeOpacity={STROKES.ringMid}  strokeWidth={1.2}/>

        {/* Case */}
        {houseLines.map(({ i, x, y, isAxis }) => (
          <line key={`house-${i}-${uid}`} x1={CX} y1={CY} x2={x} y2={y}
            stroke="#111827" strokeOpacity={isAxis ? 0.55 : 0.25} strokeWidth={isAxis ? 1.15 : 0.9}/>
        ))}

        {/* Segni + tacche */}
        {zodiacMarks.map((z, i) => (
          <g key={`z-${i}-${uid}`}>
            <line x1={z.tx1} y1={z.ty1} x2={z.tx2} y2={z.ty2}
              stroke="currentColor" strokeOpacity={STROKES.ringMid} strokeWidth={1}/>
            <g transform={`translate(${z.gx}, ${z.gy})`}><SignGlyph sign={z.sign} size={16} /></g>
          </g>
        ))}

        {/* Fascia numeri case */}
        <circle cx={CX} cy={CY} r={R_HOUSE_NUM_IN}  fill="none" stroke="currentColor" strokeOpacity={STROKES.ringThin}/>
        <circle cx={CX} cy={CY} r={R_HOUSE_NUM_OUT} fill="none" stroke="currentColor" strokeOpacity={STROKES.ringMid} strokeWidth={1.0}/>
        {houseLines.map(({ i, theta }) => {
          const a = polarToXY(CX, CY, R_HOUSE_NUM_OUT, theta);
          const b = polarToXY(CX, CY, R_HOUSE_NUM_IN, theta);
          return <line key={`hnum-tick-${i}-${uid}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke="currentColor" strokeOpacity={0.45} strokeWidth={HOUSE_NUM_TICK_W}/>;
        })}
        {houseNumbers.map(hn => (
          <text key={`hnum-${hn.n}-${uid}`} x={hn.x} y={hn.y} fontSize={HOUSE_NUM_FONT}
            textAnchor="middle" dominantBaseline="middle" fill="currentColor" opacity={0.85}
            aria-label={`House ${hn.n}`} style={{ userSelect: "none" }}>{hn.n}</text>
        ))}

        {/* Assi esterni */}
        {axisLabels.map(ax => (
          <g key={`ax-${ax.key}-${uid}`}>
            <line x1={ax.tx1} y1={ax.ty1} x2={ax.tx2} y2={ax.ty2}
              stroke={AXIS_COLOR} strokeWidth={1.2} strokeOpacity={0.9}/>
            <text x={ax.lx} y={ax.ly} fontSize={AXIS_LABEL_FONT} textAnchor="middle"
              dominantBaseline="middle" fill={AXIS_COLOR}
              style={{ userSelect: "none", fontWeight: 600 }}>{ax.key}</text>
          </g>
        ))}

        {/* Hub aspetti */}
        <circle cx={CX} cy={CY} r={R_ASPECT} fill="none" stroke="currentColor" strokeOpacity={STROKES.ringThin}/>

        {/* Aspetti */}
        {(() => {
          const pool = [...natalPlanets, ...transitPlanets];
          return aspects.map(a => {
            const A = pool.find(p => p.nsId === a.a.id)!;
            const B = pool.find(p => p.nsId === a.b.id)!;
            const isHi = involvedAspects.has(a.id);
            const c = aspectColor(a.type);
            const w = isHi ? 1.35 : 0.95;
            const op = isHi ? STROKES.aspectsHi : STROKES.aspects;
            return (
              <g key={a.id} onMouseEnter={() => setHoverAspectId(a.id)} onMouseLeave={() => setHoverAspectId(null)}>
                <line x1={A.ax} y1={A.ay} x2={B.ax} y2={B.ay} stroke={c} strokeOpacity={op} strokeWidth={w}/>
                <circle cx={A.ax} cy={A.ay} r={isHi ? 2.3 : 1.6} fill={c} fillOpacity={op}/>
                <circle cx={B.ax} cy={B.ay} r={isHi ? 2.3 : 1.6} fill={c} fillOpacity={op}/>
              </g>
            );
          });
        })()}

        {/* Tacche pianeti + hover */}
        {natalPlanets.map(p => {
          const tickStart = polarToXY(CX, CY, R_ZOD_IN, p.theta);
          const tickEnd = polarToXY(CX, CY, R_ZOD_IN - planetTickLen, p.theta);
          const involved = involvedPlanets.has(p.nsId);
          const dimOthers = (hoverPlanetId || hoverAspectId) && !involved;
          return (
            <line key={`ptick-natal-${p.nsId}`} x1={tickStart.x} y1={tickStart.y} x2={tickEnd.x} y2={tickEnd.y}
              stroke={NATAL_TICK_COLOR} strokeOpacity={dimOthers ? 0.15 : PLANET_TICK_OPACITY}
              strokeWidth={involved ? PLANET_TICK_WIDTH + 0.6 : PLANET_TICK_WIDTH}
              onMouseEnter={() => setHoverPlanetId(p.nsId)} onMouseLeave={() => setHoverPlanetId(null)}
              style={{ cursor: "pointer" }}/>
          );
        })}
        {transitPlanets.map(p => {
          const tickStart = polarToXY(CX, CY, R_ZOD_IN, p.theta);
          const tickEnd = polarToXY(CX, CY, R_ZOD_IN - planetTickLen, p.theta);
          const involved = involvedPlanets.has(p.nsId);
          const dimOthers = (hoverPlanetId || hoverAspectId) && !involved;
          return (
            <line key={`ptick-transit-${p.nsId}`} x1={tickStart.x} y1={tickStart.y} x2={tickEnd.x} y2={tickEnd.y}
              stroke={TRANSIT_TICK_COLOR} strokeOpacity={dimOthers ? 0.15 : PLANET_TICK_OPACITY}
              strokeWidth={involved ? PLANET_TICK_WIDTH + 0.6 : PLANET_TICK_WIDTH}
              onMouseEnter={() => setHoverPlanetId(p.nsId)} onMouseLeave={() => setHoverPlanetId(null)}
              style={{ cursor: "pointer" }}/>
          );
        })}

        {/* Glifi */}
        {natalPlanets.map(p => {
          const involved = involvedPlanets.has(p.nsId);
          const haloCol = signColor(p.signZ);
          const glyphSize = involved ? 18 : 16;
          const showHalo = involved || hoverPlanetId === p.nsId;
          const dimOthers = (hoverPlanetId || hoverAspectId) && !involved;
          return (
            <g key={`nat-${p.nsId}`} transform={`translate(${p.x}, ${p.y})`}
              onMouseEnter={() => setHoverPlanetId(p.nsId)} onMouseLeave={() => setHoverPlanetId(null)}
              style={{ cursor: "pointer", opacity: dimOthers ? 0.5 : 1 }}>
              {showHalo && <circle cx={0} cy={0} r={13} fill="none" stroke={haloCol} strokeOpacity={STROKES.planetHaloHi} strokeWidth={1.5}/>}
              <PlanetGlyph name={p.name} size={glyphSize} fill={NATAL_GLYPH_COLOR}/>
            </g>
          );
        })}
        {transitPlanets.map(p => {
          const involved = involvedPlanets.has(p.nsId);
          const haloCol = signColor(p.signZ);
          const glyphSize = involved ? 18 : 16;
          const showHalo = involved || hoverPlanetId === p.nsId;
          const dimOthers = (hoverPlanetId || hoverAspectId) && !involved;
          return (
            <g key={`tr-${p.nsId}`} transform={`translate(${p.x}, ${p.y})`}
              onMouseEnter={() => setHoverPlanetId(p.nsId)} onMouseLeave={() => setHoverPlanetId(null)}
              style={{ cursor: "pointer", opacity: dimOthers ? 0.5 : 1 }}>
              {showHalo && <circle cx={0} cy={0} r={13} fill="none" stroke={haloCol} strokeOpacity={STROKES.planetHaloHi} strokeWidth={1.5}/>}
              <PlanetGlyph name={p.name} size={glyphSize} fill={TRANSIT_GLYPH_COLOR}/>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
