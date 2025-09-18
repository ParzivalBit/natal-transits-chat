// src/lib/composer.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { chatComplete } from '@/lib/openai';
import {
  type PointName,
  type AspectType,
} from '@/lib/astro';
import {
  computeTransitingLongitudes,
  computeTransitEventsForDay,
  type TransitEventCalc,
} from '@/lib/transits';
import { systemRefiner, fewShot_planet, fewShot_transit } from '@/ai/systemPrompts';

type Focus = 'work' | 'relationships' | 'energy';
type Lang = 'en' | 'it' | 'es' | 'pt';

type NatalPoint = { name: PointName; longitude: number; house: number | null; sign: string };
type InterpretationRow = { id: number; type: string; key: string; title: string | null; summary: string | null; tips: string | null };

function ensureUserId(user_id?: string): string {
  const env = process.env.DEV_USER_ID;
  const uid = (user_id && user_id.length > 0) ? user_id : env;
  if (!uid) throw new Error('Missing user_id or DEV_USER_ID');
  return uid;
}

function aiBypassOn(): boolean {
  return String(process.env.AI_BYPASS).toLowerCase() === 'true' || !process.env.OPENAI_API_KEY;
}

// ———————————————— Helpers DB ————————————————

async function loadNatalPoints(user_id: string): Promise<NatalPoint[]> {
  const { data, error } = await supabaseAdmin
    .from('chart_points')
    .select('name, longitude, house, sign')
    .eq('user_id', user_id);
  if (error) throw new Error(`chart_points.select: ${error.message}`);
  return (data ?? []).map(r => ({
    name: r.name as PointName,
    longitude: r.longitude as number,
    house: r.house as number | null,
    sign: String(r.sign),
  }));
}

async function loadInterpretations(keys: string[], types: string[]): Promise<InterpretationRow[]> {
  const { data, error } = await supabaseAdmin
    .from('interpretations')
    .select('id, type, key, title, summary, tips')
    .in('type', types)
    .in('key', keys);
  if (error) throw new Error(`interpretations.select: ${error.message}`);
  return data ?? [];
}

// ———————————————— Composer Natal ————————————————

export async function composeNatalSkeleton(user_id?: string) {
  const uid = ensureUserId(user_id);
  const points = await loadNatalPoints(uid);

  const keys: string[] = [];
  for (const p of points) {
    if (p.name === 'ASC' || p.name === 'MC') continue;
    keys.push(`${p.name}_${p.sign}`, `${p.name}@${p.sign}`);
    if (p.house) keys.push(`${p.name}_${p.house}`, `${p.name}@${p.house}`);
  }

  const rows = await loadInterpretations(keys, ['planet_in_sign', 'planet_in_house']);

  const bullets: string[] = [];
  const actions: string[] = [];

  for (const p of points) {
    if (p.name === 'ASC' || p.name === 'MC') continue;
    const signCard = rows.find(r => r.key === `${p.name}_${p.sign}` || r.key === `${p.name}@${p.sign}`);
    const houseCard = p.house ? rows.find(r => r.key === `${p.name}_${p.house}` || r.key === `${p.name}@${p.house}`) : undefined;

    const title = `${p.name} in ${p.sign}${p.house ? ` (House ${p.house})` : ''}`;
    const sum = [signCard?.summary, houseCard?.summary].filter(Boolean).join(' ');
    bullets.push(`• ${title}: ${sum || 'natural strengths you can apply with patience and flexibility.'}`);

    const tipsMerge = [signCard?.tips, houseCard?.tips].filter(Boolean).join(' ');
    if (tipsMerge) {
      const split = tipsMerge.split(/[\n•\-]+/).map(s => s.trim()).filter(s => s.length > 0);
      actions.push(...split.slice(0, 2));
    }
  }

  if (actions.length === 0) {
    actions.push('Write 3 lines about what energizes you today.');
    actions.push('Tidy one small area for 5 minutes.');
  }

  return { bullets, actions: actions.slice(0, 6) };
}

function buildNatalEN(skeleton: { bullets: string[]; actions: string[] }, focus: Focus[]): string {
  const f = focus.length ? focus.join(', ') : 'general';
  return [
    `Here’s a gentle read of your natal chart themes (focus: ${f}).`,
    '',
    ...skeleton.bullets,
    '',
    'Try today:',
    ...skeleton.actions.map(a => `• ${a}`),
    '',
    'Disclaimer: For wellness/entertainment only. Not medical, legal, or financial advice.'
  ].join('\n');
}

export async function refineNatalText(skeleton: { bullets: string[]; actions: string[] }, focus: Focus[], lang: Lang = 'en') {
  if (aiBypassOn()) {
    // Bypass: ritorna EN semplice
    const textEN = buildNatalEN(skeleton, focus);
    return lang === 'en' ? textEN : textEN; // in bypass manteniamo EN
  }

  const userMsg = [
    `User focus: ${focus.join(', ') || 'general'}.`,
    'Skeleton:',
    ...skeleton.bullets,
    'Micro-actions:',
    ...skeleton.actions.map(a => `- ${a}`)
  ].join('\n');

  const contentEN = await chatComplete(
    [
      { role: 'system', content: systemRefiner },
      { role: 'user', content: fewShot_planet.user },
      { role: 'assistant', content: fewShot_planet.assistant },
      { role: 'user', content: userMsg },
    ],
    true
  );

  if (lang === 'en') return contentEN;

  const langLabel = lang === 'it' ? 'Italian' : lang === 'es' ? 'Spanish' : 'Portuguese';
  const translated = await chatComplete(
    [
      { role: 'system', content: 'Translate to the requested language preserving tone and bullet structure. Keep it concise.' },
      { role: 'user', content: `Language: ${langLabel}\n\n${contentEN}` }
    ],
    true
  );
  return translated;
}

// ———————————————— Composer Transits ————————————————

export async function composeTransitsSkeleton(user_id?: string, dateIso?: string, limit = 5) {
  const uid = ensureUserId(user_id);
  const date = dateIso ?? new Date().toISOString().slice(0, 10);

  const points = await loadNatalPoints(uid);
  const natalLite = points.map(p => ({ name: p.name, longitude: p.longitude }));

  const longs = computeTransitingLongitudes(date);
  const events = computeTransitEventsForDay(date, longs, natalLite);
  const top = events.slice(0, limit);

  const keys: string[] = [];
  for (const e of top) {
    keys.push(`${e.t_planet}_${e.aspect}_${e.n_point}`, `${e.t_planet}@${e.n_point}@${e.aspect}`);
  }
  const rows = await loadInterpretations(keys, ['transit_to_nat']);

  const bullets: string[] = [];
  const actions: string[] = [];

  for (const e of top) {
    const title = `${e.t_planet} ${labelAspect(e.aspect)} ${e.n_point} (orb ${e.orb}°)`;
    const card = rows.find(r =>
      r.key === `${e.t_planet}_${e.aspect}_${e.n_point}` ||
      r.key === `${e.t_planet}@${e.n_point}@${e.aspect}`
    );
    bullets.push(`• ${title}: ${card?.summary || 'energy pattern you can use with awareness.'}`);

    if (card?.tips) {
      const split = card.tips.split(/[\n•\-]+/).map(s => s.trim()).filter(s => s.length > 0);
      actions.push(...split.slice(0, 2));
    }
  }

  if (actions.length === 0) {
    actions.push('2 minutes of slow breathing (inhale 4, exhale 6).');
    actions.push('Write one line about your intention today.');
  }

  return { date, bullets, actions, top };
}

function buildTransitsEN(skeleton: { date: string; bullets: string[]; actions: string[] }, focus: Focus[]): string {
  const f = focus.length ? focus.join(', ') : 'general';
  return [
    `Transits for ${skeleton.date} (focus: ${f}).`,
    '',
    ...skeleton.bullets,
    '',
    'Try today:',
    ...skeleton.actions.map(a => `• ${a}`),
    '',
    'Disclaimer: For wellness/entertainment only. Not medical, legal, or financial advice.'
  ].join('\n');
}

export async function refineTransitText(
  skeleton: { date: string; bullets: string[]; actions: string[]; top: TransitEventCalc[] },
  focus: Focus[],
  lang: Lang = 'en'
) {
  if (aiBypassOn()) {
    const textEN = buildTransitsEN(skeleton, focus);
    return lang === 'en' ? textEN : textEN; // in bypass manteniamo EN
  }

  const userMsg = [
    `Date: ${skeleton.date}`,
    `User focus: ${focus.join(', ') || 'general'}.`,
    'Transit bullets:',
    ...skeleton.bullets,
    'Micro-actions:',
    ...skeleton.actions.map(a => `- ${a}`)
  ].join('\n');

  const contentEN = await chatComplete(
    [
      { role: 'system', content: systemRefiner },
      { role: 'user', content: fewShot_transit.user },
      { role: 'assistant', content: fewShot_transit.assistant },
      { role: 'user', content: userMsg },
    ],
    true
  );

  if (lang === 'en') return contentEN;

  const langLabel = lang === 'it' ? 'Italian' : lang === 'es' ? 'Spanish' : 'Portuguese';
  const translated = await chatComplete(
    [
      { role: 'system', content: 'Translate to the requested language preserving tone and bullet structure. Keep it concise.' },
      { role: 'user', content: `Language: ${langLabel}\n\n${contentEN}` }
    ],
    true
  );
  return translated;
}

// ———————————————— Utils ————————————————

function labelAspect(a: AspectType): string {
  switch (a) {
    case 'conjunction': return 'conjunct';
    case 'sextile':     return 'sextile to';
    case 'square':      return 'square to';
    case 'trine':       return 'trine to';
    case 'opposition':  return 'opposition to';
  }
}
