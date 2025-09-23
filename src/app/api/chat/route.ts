// src/app/api/chat/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerComponentClient } from '@/lib/supabaseServer';
import OpenAI from 'openai';
import { systemChat } from '@/ai/systemPrompts';

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

// ✅ aggiungi un tipo per le righe della tabella chart_points
type ChartPointRow = {
  name: string;
  sign: string | null;
  house: number | null;
  retro: boolean | null;
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function buildNatalContext(rows: ChartPointRow[]) {
  if (!rows || rows.length === 0) return '';
  const lines = rows.map(r => {
    const h = r.house ? ` H${r.house}` : '';
    const retro = r.retro ? ' (R)' : '';
    return `${r.name}: ${r.sign ?? '-'}${h}${retro}`;
  });
  return `CONTEXT_NATAL
${lines.join('\n')}`;
}

function buildTransitsContext(
  dateISO: string,
  hits: Array<{ t_planet: string; n_point: string; aspect: string; orb: number; score: number }>
) {
  if (!hits || hits.length === 0) return '';
  const lines = hits.map(t => `${dateISO}: ${t.t_planet} ${t.aspect} ${t.n_point} (orb ${t.orb}°, score ${t.score})`);
  return `CONTEXT_TRANSITS_TODAY
${lines.join('\n')}`;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerComponentClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const messages = (body?.messages ?? []) as Msg[];
    const sessionId = body?.session_id as string | undefined;
    const uiContext = typeof body?.context === 'string' ? body.context.trim() : '';
    const techMode: boolean = !!body?.techMode;
    const dateOverride = typeof body?.date === 'string' ? body.date : null; // opzionale

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'missing prompt' }, { status: 400 });
    }

    // 1) Preleva sempre i punti natali
    const { data: natalRows } = await supabase
      .from('chart_points')
      .select('name, sign, house, retro')
      .eq('user_id', user.id);

    // ⬇️ elimina `as any`, usa il tipo forte
    const natalCtx = buildNatalContext((natalRows ?? []) as ChartPointRow[]);

    // 2) Aggiungi transiti odierni (o data override) se non hai già un contesto transiti
    let transitsCtx = '';
    const hasTransitsInUI = uiContext.includes('CONTEXT_TRANSITS_TODAY') || uiContext.includes('MONTH_TRANSITS');

    if (!hasTransitsInUI) {
      const { data: prefs } = await supabase
        .from('user_prefs')
        .select('current_tz_name')
        .eq('user_id', user.id)
        .maybeSingle();

      const tz = prefs?.current_tz_name ?? 'UTC';
      const base = new URL(req.url).origin;
      const dateISO = dateOverride ?? new Date().toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD

      const res = await fetch(`${base}/api/transits?date=${dateISO}&limit=7`, {
        headers: { cookie: req.headers.get('cookie') ?? '' },
        cache: 'no-store',
      });

      if (res.ok) {
        const j = await res.json();
        const hits = Array.isArray(j?.top)
          ? (j.top as Array<{ t_planet: string; n_point: string; aspect: string; orb: number; score: number }>)
          : [];
        transitsCtx = buildTransitsContext(dateISO, hits);
      }
    }

        // --- NEW: house system + cusps context for the chatbot ---
    // preferenza utente (whole|placidus)
    const { data: prefRow } = await supabase
      .from('user_prefs')
      .select('house_system')
      .eq('user_id', user.id)
      .maybeSingle();

    const preferredSystem = (prefRow?.house_system ?? 'whole') as 'whole' | 'placidus';

    // cuspidi correnti (12 righe: cusp 1..12) per il sistema scelto
    const { data: cuspRows } = await supabase
      .from('house_cusps')
      .select('cusp, longitude, system')
      .eq('user_id', user.id)
      .eq('system', preferredSystem)
      .order('cusp', { ascending: true });

    let houseCtx = '';
    if (Array.isArray(cuspRows) && cuspRows.length === 12) {
      const cusps = cuspRows.map(r => Number(r.longitude));
      const asc = cusps[0];
      const mc  = cusps[9];
      houseCtx = [
        `HOUSE_SYSTEM=${preferredSystem.toUpperCase()}`,
        `ASC=${asc.toFixed(2)}°, MC=${mc.toFixed(2)}°`,
        `CUSPS: ${cusps.map((deg, i) => `C${i+1}=${deg.toFixed(2)}°`).join(' | ')}`,
      ].join('\n');
    } else {
      // se non ci sono cuspidi salvate (es. utente senza orario di nascita), forniamo solo il sistema
      houseCtx = `HOUSE_SYSTEM=${preferredSystem.toUpperCase()}\nCUSPS: none`;
    }


    const sysBlocks = [
      systemChat,
      techMode ? 'SHOW_TECH=true' : 'SHOW_TECH=false',
      houseCtx,
      uiContext,
      natalCtx,
      transitsCtx,
    ].filter(Boolean);

    const chat: Msg[] = [{ role: 'system', content: sysBlocks.join('\n\n') }, ...messages];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      messages: chat,
    });
    const answer = completion.choices[0]?.message?.content ?? '';

    if (sessionId) {
      const last = messages[messages.length - 1];
      if (last?.role === 'user') {
        await supabase.from('chat_messages').insert({
          session_id: sessionId,
          role: 'user',
          content: last.content ?? '',
        });
      }
      await supabase.from('chat_messages').insert({
        session_id: sessionId,
        role: 'assistant',
        content: answer,
      });
    }

    return NextResponse.json({ ok: true, answer });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[api/chat] ERROR:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
