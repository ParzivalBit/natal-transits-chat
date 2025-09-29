// src/app/api/synastry/compute/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createSupabaseServerRouteClient } from '@/lib/supabaseServer';
import { computeSynastryAspects } from '@/lib/synastry/aspects';
import { type PointName } from '@/lib/astro';

// punti consentiti (per sicurezza)
const ALLOWED: ReadonlySet<PointName> = new Set<PointName>([
  'Sun','Moon','Mercury','Venus','Mars',
  'Jupiter','Saturn','Uranus','Neptune','Pluto',
  'ASC','MC',
]);

type RowCP = { name: string; longitude: number };

// Guard per string→PointName
function isPointName(x: string): x is PointName {
  return ALLOWED.has(x as PointName);
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerRouteClient();

  // Auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const persist = (url.searchParams.get('persist') ?? '0') !== '0';

  // Body
  let person_id: string | undefined;
  try {
    const json = await req.json().catch(() => ({}));
    person_id = typeof json?.person_id === 'string' ? json.person_id : undefined;
  } catch {
    // noop
  }
  if (!person_id) {
    return NextResponse.json({ ok: false, error: 'missing person_id' }, { status: 400 });
  }

  // Verifica ownership persona (ed evitiamo 404 silenziosi sotto RLS)
  const { data: person, error: pErr } = await supabase
    .from('people')
    .select('id')
    .eq('id', person_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
  if (!person) return NextResponse.json({ ok: false, error: 'person not found' }, { status: 404 });

  // Carica punti UTENTE
  const { data: uRaw, error: uErr } = await supabase
    .from('chart_points')
    .select('name,longitude')
    .eq('user_id', user.id);
  if (uErr) return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 });

  // Carica punti PERSONA
  const { data: pRaw, error: pPErr } = await supabase
    .from('people_chart_points')
    .select('name,longitude')
    .eq('person_id', person_id);
  if (pPErr) return NextResponse.json({ ok: false, error: pPErr.message }, { status: 500 });

  const userPts = (uRaw ?? [])
    .filter((r: RowCP): r is RowCP & { name: PointName } => isPointName(r.name))
    .map((r) => ({ name: r.name, lon: Number(r.longitude) }));

  const personPts = (pRaw ?? [])
    .filter((r: RowCP): r is RowCP & { name: PointName } => isPointName(r.name))
  .map((r) => ({ name: r.name, lon: Number(r.longitude) }));

  if (userPts.length === 0 || personPts.length === 0) {
    return NextResponse.json({
      ok: true,
      computed: 0,
      persisted: 0,
      reason: 'missing points',
    });
  }

  // Calcola aspetti (usa lib robusta esistente)
  const aspects = computeSynastryAspects(userPts, personPts, { includeMinor: false });

  // Persistenza opzionale
  let persisted = 0;
  if (persist) {
    // pulizia precedente coppia (user, person)
    const del = await supabase
      .from('synastry_aspects')
      .delete()
      .eq('user_id', user.id)
      .eq('person_id', person_id);
    if (del.error) {
      return NextResponse.json({ ok: false, error: del.error.message, stage: 'delete' }, { status: 500 });
    }

    if (aspects.length) {
      const rows = aspects.map(a => ({
        user_id: user.id,
        person_id,
        p1_owner: 'user',
        p1_name: a.a.name,  // es. 'Sun','ASC'
        p2_owner: 'person',
        p2_name: a.b.name,
        aspect: a.aspect,    // 'conjunction' | 'sextile' | ...
        angle: a.exact,      // 0,60,90,120,150,180
        orb: a.orb,          // distanza in gradi dall'angle "esatto"
        applying: a.applying ?? null,
        score: a.score ?? null,
      }));

      const ins = await supabase.from('synastry_aspects').insert(rows);
      if (ins.error) {
        return NextResponse.json({ ok: false, error: ins.error.message, stage: 'insert' }, { status: 500 });
      }
      persisted = rows.length;
    }
  }

  return NextResponse.json({
    ok: true,
    computed: aspects.length,
    persisted,
    sample: aspects.slice(0, 5),
  });
}
