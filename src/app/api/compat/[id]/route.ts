// src/app/api/compat/[id]/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerRouteClient } from '@/lib/supabaseServer';
import { DateTime } from 'luxon';
import { computeSynastryAspects, formatSynastryContext, type NatalPointLite } from '@/lib/synastry';
import type { PointName } from '@/lib/astro';
import { computeTransitingLongitudes, computeTransitEventsForDay } from '@/lib/transits';

/* ---------------- utils sicure ---------------- */
function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}
function isRecord(o: unknown): o is Record<string, unknown> {
  return typeof o === 'object' && o !== null;
}
function get(obj: unknown, path: Array<string | number>): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (!isRecord(cur) && !Array.isArray(cur)) return undefined;
    if (typeof key === 'number') {
      if (!Array.isArray(cur) || key < 0 || key >= cur.length) return undefined;
      cur = cur[key];
    } else {
      const rec = cur as Record<string, unknown>;
      if (!(key in rec)) return undefined;
      cur = rec[key];
    }
  }
  return cur;
}
const SIGNS = [
  'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
  'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces',
] as const;
type SignName = (typeof SIGNS)[number];
function signFromLongitude(lon: unknown): SignName | null {
  const x = Number(lon);
  if (!Number.isFinite(x)) return null;
  const deg = ((x % 360) + 360) % 360;
  return SIGNS[Math.floor(deg / 30)] ?? null;
}
function findMoonSign(transits: unknown): SignName | null {
  if (Array.isArray(transits)) {
    for (const it of transits) {
      if (isRecord(it)) {
        const name = String(get(it, ['name']) ?? '').toLowerCase();
        if (name === 'moon' || name === 'luna') {
          const lon = get(it, ['longitude']);
          const s = signFromLongitude(lon);
          if (s) return s;
        }
      }
    }
  }
  if (isRecord(transits)) {
    const moonObj = get(transits, ['Moon']) ?? get(transits, ['Luna']);
    const s = signFromLongitude(get(moonObj, ['longitude']));
    if (s) return s;
  }
  return null;
}
function moonDignityMultiplier(sign: SignName | null): number {
  // Luna: domicilio Cancer, esaltazione Taurus, detrimento Capricorn, caduta Scorpio
  if (sign === 'Cancer') return 1.15;
  if (sign === 'Taurus') return 1.12;
  if (sign === 'Capricorn') return 0.90;
  if (sign === 'Scorpio') return 0.88;
  return 1.0;
}
/* ---------------------------------------------- */

type RowPoint = {
  name: string;
  longitude: number;
  sign?: string | null;
  house?: number | null;
  retro?: boolean | null;
};

type TransitHit = {
  t_planet: string;   // pianeta in transito
  aspect: string;     // 'trine' | 'sextile' | 'conjunction' | 'opposition' | 'square'
  n_point: string;    // punto natale (Sun/Moon/Venus/Mars/ASC/DSC/MC…)
  orb: number;        // gradi
  score: number;      // 0..1
  side: 'ME' | 'PEER';
};

function natalBlock(tag: 'CONTEXT_NATAL' | 'CONTEXT_PEER_NATAL', label: string | null, pts: RowPoint[]) {
  const head = label ? `${tag} ${label}` : tag;
  const lines = pts.map(p => {
    const h = p.house ?? null;
    const retro = p.retro ? ' (R)' : '';
    const sign = p.sign || '';
    const htxt = h !== null ? ` H${h}` : '';
    return `${p.name}: ${sign}${htxt}${retro}`;
  });
  return `${head}\n${lines.join('\n')}`;
}

function extractSunAscSummary(label: string, pts: RowPoint[]) {
  const nameEq = (s: string) => (n: string) => n.toLowerCase() === s.toLowerCase();
  const find = (names: string[]) => pts.find(p => names.some(n => nameEq(n)(p.name)));
  const sun = find(['Sun','Sole']);
  const asc = find(['ASC','Asc','Ascendant','Ascendente']);
  const moon = find(['Moon','Luna']);
  return `PEER_SUMMARY ${label}\nSun: ${sun?.sign || '?'}${moon?.sign ? ` | Moon: ${moon.sign}` : ''}${asc?.sign ? ` | Asc: ${asc.sign}` : ''}`;
}

/* ------------------- weight e firme lente ------------------- */
function weightForRomance(h: TransitHit): number {
  let w = (typeof h.score === 'number' ? h.score : 0);
  const a = h.aspect.toLowerCase();
  const tp = h.t_planet.toLowerCase();
  const np = h.n_point.toLowerCase();

  if (a.includes('trine') || a.includes('sextile')) w *= 1.25;
  if (a.includes('conjunction')) w *= 1.15;
  if (a.includes('opposition')) w *= 0.95;
  if (a.includes('square')) w *= 0.80;

  if (tp.includes('venus')) w *= 1.35;
  if (tp.includes('jupiter')) w *= 1.20;
  if (tp.includes('moon')) w *= 1.15;
  if (tp.includes('mars')) w *= 1.10;

  if (/(sun|moon|venus|mars|asc|dsc|desc|mc|ic)/.test(np)) w *= 1.20;

  if ((tp.includes('saturn') || tp.includes('neptune')) && /(moon|venus)/.test(np)) w *= 0.75;

  if (Math.abs(h.orb) <= 2) w *= 1.15;

  return w;
}
function slowAspectSignature(h: TransitHit): string | null {
  if (/moon/i.test(h.t_planet)) return null; // variabile → non considerata "lenta"
  return `${h.t_planet.toLowerCase()}|${h.aspect.toLowerCase()}|${h.n_point.toLowerCase()}|${h.side}`;
}
function formatHitLine(dateISO: string, h: TransitHit) {
  const orbTxt = Number.isFinite(h.orb) ? `${Math.abs(h.orb).toFixed(2)}°` : '?°';
  return `${dateISO}: ${h.side}:${h.t_planet} ${h.aspect} ${h.n_point} (orb ${orbTxt}, score ${Math.round((h.score || 0) * 100)})`;
}
/* ------------------------------------------------------------- */

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createSupabaseServerRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return bad('Unauthorized', 401);

    const personId = params.id;

    // Natal utente
    const { data: meFull } = await supabase
      .from('chart_points')
      .select('name,longitude,sign,house,retro')
      .eq('user_id', user.id);

    const meRows: RowPoint[] = (meFull ?? []).map(r => ({
      name: String(r.name),
      longitude: Number(r.longitude),
      sign: r.sign ?? null,
      house: r.house ?? null,
      retro: Boolean(r.retro),
    }));

    // Persona
    const { data: person, error: eP } = await supabase
      .from('people')
      .select('label')
      .eq('user_id', user.id)
      .eq('id', personId)
      .single();
    if (eP || !person) return bad('Person not found', 404);

    const { data: pPoints } = await supabase
      .from('people_chart_points')
      .select('name,longitude,sign,house,retro')
      .eq('person_id', personId);

    const otherRows: RowPoint[] = (pPoints ?? []).map(r => ({
      name: String(r.name),
      longitude: Number(r.longitude),
      sign: r.sign ?? null,
      house: r.house ?? null,
      retro: Boolean(r.retro),
    }));

    // Sinastria (top 7)
    const meLite: NatalPointLite[] = meRows.map(r => ({ name: r.name as PointName, longitude: r.longitude }));
    const otherLite: NatalPointLite[] = otherRows.map(r => ({ name: r.name as PointName, longitude: r.longitude }));
    const syn = computeSynastryAspects(meLite, otherLite).slice(0, 7);

    // TZ utente
    const { data: prefs } = await supabase
      .from('user_prefs')
      .select('current_tz_name')
      .eq('user_id', user.id)
      .maybeSingle();
    const tz = prefs?.current_tz_name || 'UTC';

    // Oggi
    const todayISO = DateTime.now().setZone(tz).toISODate()!;
    const transitingToday = computeTransitingLongitudes(todayISO);
    const hitsMeToday = computeTransitEventsForDay(todayISO, transitingToday, meLite).map(h => ({ ...h, side: 'ME' as const }));
    const hitsOtherToday = computeTransitEventsForDay(todayISO, transitingToday, otherLite).map(h => ({ ...h, side: 'PEER' as const }));
    const topCombinedToday = [...hitsMeToday.slice(0, 4), ...hitsOtherToday.slice(0, 4)];
    //const transCtxToday = `CONTEXT_TRANSITS_TODAY\n${topCombinedToday.map(t => formatHitLine(todayISO, t)).join('\n')}`;

    // Finestra prossimi 45 giorni (per avere alternative su mese successivo)
    const start = DateTime.fromISO(todayISO, { zone: tz }).startOf('day');
    const days = 45;

    type DayRow = {
      dateISO: string;
      list: TransitHit[];
      score: number;
      moonSign: SignName | null;
      slowSignatures: Set<string>;
    };

    const windowRows: DayRow[] = [];

    for (let i = 0; i < days; i++) {
      const d = start.plus({ days: i });
      const dISO = d.toISODate()!;
      const trans = computeTransitingLongitudes(dISO);

      const meHits = computeTransitEventsForDay(dISO, trans, meLite).map(h => ({ ...h, side: 'ME' as const }));
      const otherHits = computeTransitEventsForDay(dISO, trans, otherLite).map(h => ({ ...h, side: 'PEER' as const }));
      const dayHits: TransitHit[] = [...meHits, ...otherHits]
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 10)
        .map(h => ({
          t_planet: String(h.t_planet),
          aspect: String(h.aspect),
          n_point: String(h.n_point),
          orb: Number(h.orb ?? 0),
          score: Number(h.score ?? 0),
          side: h.side,
        }));

      let dayScore = dayHits.reduce((acc, h) => acc + weightForRomance(h), 0);

      // Luna: dignità e armonici ai punti affettivi
      const moonSign = findMoonSign(trans);
      const moonMul = moonDignityMultiplier(moonSign);
      const moonHits = dayHits.filter(h => /moon/i.test(h.t_planet));
      const moonHarm = moonHits.filter(h => /(trine|sextile|conjunction)/i.test(h.aspect)).length;
      const moonToKey = moonHits.filter(h => /(sun|moon|venus|mars|asc|dsc|desc)/i.test(h.n_point.toLowerCase())).length;

      dayScore *= moonMul;
      dayScore *= 1 + Math.min(0.30, 0.05 * moonHarm + 0.03 * moonToKey);

      const slow = new Set<string>();
      for (const h of dayHits) {
        const sig = slowAspectSignature(h);
        if (sig) slow.add(sig);
      }

      windowRows.push({ dateISO: dISO, list: dayHits, score: dayScore, moonSign, slowSignatures: slow });
    }

    /* ---------- Costruzione finestre (range) ---------- */
    // 1) prendo i picchi (giorni top) e poi espando a sinistra/destra
    // includendo giorni contigui che restano sopra una soglia relativa (85% del picco)
    const used = new Set<string>();
    const peaks = [...windowRows].sort((a, b) => b.score - a.score);
    const RATIO = 0.85;
    const windows: {
      start: string; end: string; mid: string; score: number;
      moonSeq: SignName[]; // sequenza di segni lunari nel range
      keyAspects: string[]; // 2–3 aspetti rappresentativi
      slowSignatureBag: Set<string>; // unione slow sig del range
    }[] = [];

    for (const pk of peaks) {
      if (used.has(pk.dateISO)) continue;

      // estendo a sx/dx su giorni consecutivi
      let left = pk;
      let right = pk;
      const pkScore = pk.score;

      // sinistra
      while (true) {
        const day = DateTime.fromISO(left.dateISO).minus({ days: 1 }).toISODate()!;
        const prev = windowRows.find(r => r.dateISO === day);
        if (!prev || used.has(prev.dateISO)) break;
        if (prev.score < pkScore * RATIO) break;
        left = prev;
      }
      // destra
      while (true) {
        const day = DateTime.fromISO(right.dateISO).plus({ days: 1 }).toISODate()!;
        const next = windowRows.find(r => r.dateISO === day);
        if (!next || used.has(next.dateISO)) break;
        if (next.score < pkScore * RATIO) break;
        right = next;
      }

      // marca usati
      const startDT = DateTime.fromISO(left.dateISO);
      const endDT = DateTime.fromISO(right.dateISO);
      for (let d = startDT; d <= endDT; d = d.plus({ days: 1 })) {
        used.add(d.toISODate()!);
      }

      // colletta info del range
      const moonSeq: SignName[] = [];
      const slowBag = new Set<string>();
      const aspectPool: TransitHit[] = [];
      for (let d = startDT; d <= endDT; d = d.plus({ days: 1 })) {
        const row = windowRows.find(r => r.dateISO === d.toISODate());
        if (row) {
          if (row.moonSign) moonSeq.push(row.moonSign);
          row.slowSignatures.forEach(s => slowBag.add(s));
          aspectPool.push(...row.list);
        }
      }
      // prendo i 3 aspetti più “romantici” e armonici come rappresentativi
      const rep = aspectPool
        .filter(h => /(trine|sextile|conjunction)/i.test(h.aspect))
        .sort((a, b) => weightForRomance(b) - weightForRomance(a))
        .slice(0, 3)
        .map(h => `${h.side}:${h.t_planet} ${h.aspect} ${h.n_point} (orb ${Math.abs(h.orb).toFixed(2)}°)`);

      windows.push({
        start: left.dateISO,
        end: right.dateISO,
        mid: pk.dateISO,
        score: pk.score,
        moonSeq,
        keyAspects: rep,
        slowSignatureBag: slowBag,
      });
    }

    // 2) seleziono max 2–3 finestre VARIE: distanza minima 7 giorni e slow pattern poco sovrapposti
    const MIN_GAP_DAYS = 7;
    function farEnough(a: string, b: string): boolean {
      const da = DateTime.fromISO(a);
      const db = DateTime.fromISO(b);
      return Math.abs(da.diff(db, 'days').days) >= MIN_GAP_DAYS;
    }
    function slowOverlap(a: Set<string>, b: Set<string>): number {
      let c = 0;
      for (const s of a) if (b.has(s)) c++;
      return c;
    }

    const picked: typeof windows = [];
    for (const w of windows.sort((a, b) => b.score - a.score)) {
      const okGap = picked.every(p => farEnough(w.mid, p.mid));
      const okSlow = picked.every(p => slowOverlap(w.slowSignatureBag, p.slowSignatureBag) < 2);
      if (okGap && okSlow) picked.push(w);
      if (picked.length >= 3) break;
    }

    // 3) blocchi di contesto
    const natalMeCtx = natalBlock('CONTEXT_NATAL', null, meRows);
    const natalOtherCtx = natalBlock('CONTEXT_PEER_NATAL', person.label, otherRows);
    const peerSummary = extractSunAscSummary(person.label, otherRows);

    const synCtx = formatSynastryContext(syn, 'You', person.label);

    const nextBlockLines: string[] = [];
    for (const r of windowRows) {
      const lines = r.list.slice(0, 6).map(h => `- ${formatHitLine(r.dateISO, h)}`);
      const moonTxt = r.moonSign ? ` (Moon in ${r.moonSign})` : '';
      nextBlockLines.push(`${r.dateISO}${moonTxt}\n${lines.join('\n')}`);
    }
    const transNextBlock = `CONTEXT_TRANSITS_NEXT_45\n${nextBlockLines.join('\n')}`;

    // Miglior finestra singola (entro 30 giorni) per risposte "una data/finestra"
    const within30 = windows.filter(w => DateTime.fromISO(w.start) <= start.plus({ days: 30 }));
    const bestWindow = (within30.length ? within30 : windows).sort((a, b) => b.score - a.score)[0];

    const bestLine = (() => {
      const moonSpan = bestWindow.moonSeq.length
        ? `Moon: ${bestWindow.moonSeq[0]}${bestWindow.moonSeq.length > 1 ? ` → ${bestWindow.moonSeq[bestWindow.moonSeq.length - 1]}` : ''}`
        : '';
      return `${bestWindow.start}..${bestWindow.end} — ${moonSpan} — ${bestWindow.keyAspects.join(' | ')}`;
    })();
    const bestBlock = `BEST_WINDOW_NEXT_30\n${bestLine}`;

    const windowsLines = picked.slice(0, 2).map(w => {
      const moonSpan = w.moonSeq.length
        ? `Moon: ${w.moonSeq[0]}${w.moonSeq.length > 1 ? ` → ${w.moonSeq[w.moonSeq.length - 1]}` : ''}`
        : '';
      return `${w.start}..${w.end} — ${moonSpan} — ${w.keyAspects.join(' | ')}`;
    });
    const windowsBlock = `DATE_WINDOWS_NEXT_45\n${windowsLines.join('\n')}`;

    const guidelines = `Guidelines:
- Se l'utente chiede UNA data/finestra: usa BEST_WINDOW_NEXT_30 (range compatto, senza punteggi), spiega con aspetti e orbi.
- Se chiede alternative: usa DATE_WINDOWS_NEXT_45 (max 2 range, distanti ≥7 giorni e con pattern lenti diversi).
- Evita elenchi numerati e punteggi: rispondi in modo discorsivo; cita Luna (segno) come discriminante temporale.`;

    const context = [
      natalMeCtx,
      natalOtherCtx,
      peerSummary,
      synCtx,
      `CONTEXT_TRANSITS_TODAY\n${topCombinedToday.map(t => formatHitLine(todayISO, t)).join('\n')}`,
      transNextBlock,
      bestBlock,
      windowsBlock,
      guidelines,
    ].join('\n\n');

    return NextResponse.json({
      ok: true,
      context,
      date: todayISO,
      window_start: start.toISODate(),
      window_end: start.plus({ days }).toISODate(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return bad(msg, 500);
  }
}
