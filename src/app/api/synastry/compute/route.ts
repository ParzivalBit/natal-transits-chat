// src/app/api/synastry/compute/route.ts
import { NextResponse } from 'next/server';
import { createSupabaseServerRouteClient } from '@/lib/supabaseServer';
import type { PostgrestError } from '@supabase/supabase-js';
import { computeSynastryAspects } from '@/lib/synastry/aspects';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ---- Tipi compatibili con il core grafico/persistenza ----
type AngleName = 'ASC' | 'MC';
type PlanetName =
  | 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars'
  | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune' | 'Pluto';

type ChartPoint = {
  name: PlanetName | AngleName;
  lon: number;
  retro?: boolean;
  sign?: string | null;
  house?: number | null;
  who: 'user' | 'person';
};

// Questo è il formato che vogliamo usare/persistire
type SynAspect = {
  p1: PlanetName | AngleName;
  p2: PlanetName | AngleName;
  aspect: string;
  orb: number;
};

type PointRowUser = {
  name: string;
  longitude: number;
  retro: boolean | null;
  sign: string | null;
  house: number | null;
};
type PointRowPerson = {
  name: string;
  longitude: number;
  retro: boolean | null;
};

// Guard nomi validi (pianeti + angoli)
const VALID_NAMES = new Set<string>([
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
  'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
  'ASC', 'MC',
]);
function toChartPointName(n: string): PlanetName | AngleName | null {
  return VALID_NAMES.has(n) ? (n as PlanetName | AngleName) : null;
}
function isValidName(n: unknown): n is PlanetName | AngleName {
  return typeof n === 'string' && VALID_NAMES.has(n);
}
function isFiniteNum(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}
function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

// --- Normalizzazione aspetti dal core (che potrebbe avere nomi diversi) ---
type CoreA = { p1: unknown; p2: unknown; aspect: unknown; orb: unknown };
type CoreB = { point1: unknown; point2: unknown; type: unknown; orb: unknown };
type CoreC = { a: unknown; b: unknown; name: unknown; orb: unknown };

function isCoreA(x: unknown): x is CoreA {
  return isRecord(x) && 'p1' in x && 'p2' in x && 'aspect' in x && 'orb' in x;
}
function isCoreB(x: unknown): x is CoreB {
  return isRecord(x) && 'point1' in x && 'point2' in x && 'type' in x && 'orb' in x;
}
function isCoreC(x: unknown): x is CoreC {
  return isRecord(x) && 'a' in x && 'b' in x && 'name' in x && 'orb' in x;
}

function toSynAspect(x: unknown): SynAspect | null {
  if (isCoreA(x)) {
    if (isValidName(x.p1) && isValidName(x.p2) && typeof x.aspect === 'string' && isFiniteNum(x.orb)) {
      return { p1: x.p1, p2: x.p2, aspect: x.aspect, orb: x.orb };
    }
    return null;
  }
  if (isCoreB(x)) {
    if (isValidName(x.point1) && isValidName(x.point2) && typeof x.type === 'string' && isFiniteNum(x.orb)) {
      return { p1: x.point1, p2: x.point2, aspect: x.type, orb: x.orb };
    }
    return null;
  }
  if (isCoreC(x)) {
    if (isValidName(x.a) && isValidName(x.b) && typeof x.name === 'string' && isFiniteNum(x.orb)) {
      return { p1: x.a, p2: x.b, aspect: x.name, orb: x.orb };
    }
    return null;
  }
  return null;
}

// type guard per filtri (da (ChartPoint|null) a ChartPoint)
function notNull<T>(x: T | null): x is T {
  return x !== null;
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerRouteClient();

  try {
    const url = new URL(req.url);
    const persist = url.searchParams.get('persist') === '1';

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id ?? null;
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { person_id?: string };
    const person_id = body.person_id ?? '';
    if (!person_id) return NextResponse.json({ error: 'Missing person_id' }, { status: 400 });

    // Punti utente
    const selUser = await supabase
      .from('chart_points')
      .select('name,longitude,retro,sign,house')
      .eq('user_id', userId);
    if (selUser.error) {
      const e = selUser.error as PostgrestError;
      return NextResponse.json({ error: e.message, stage: 'user-points' }, { status: 500 });
    }
    const uPts = (selUser.data ?? []) as PointRowUser[];

    // Punti persona
    const selPerson = await supabase
      .from('people_chart_points')
      .select('name,longitude,retro')
      .eq('person_id', person_id);
    if (selPerson.error) {
      const e = selPerson.error as PostgrestError;
      return NextResponse.json({ error: e.message, stage: 'person-points' }, { status: 500 });
    }
    const pPts = (selPerson.data ?? []) as PointRowPerson[];

    // Normalizza → ChartPoint[] (tipizziamo esplicitamente la map come (ChartPoint|null)[])
    const userPointsArr: (ChartPoint | null)[] = uPts.map((p) => {
      const nm = toChartPointName(p.name);
      if (!nm) return null;
      const lon = Number(p.longitude);
      if (!Number.isFinite(lon)) return null;
      const cp: ChartPoint = {
        name: nm,
        lon,
        retro: !!p.retro,
        sign: p.sign,
        house: p.house,
        who: 'user',
      };
      return cp;
    });
    const userPoints: ChartPoint[] = userPointsArr.filter(notNull);

    const personPointsArr: (ChartPoint | null)[] = pPts.map((p) => {
      const nm = toChartPointName(p.name);
      if (!nm) return null;
      const lon = Number(p.longitude);
      if (!Number.isFinite(lon)) return null;
      const cp: ChartPoint = {
        name: nm,
        lon,
        retro: !!p.retro,
        who: 'person',
      };
      return cp;
    });
    const personPoints: ChartPoint[] = personPointsArr.filter(notNull);

    // Calcolo aspetti (tipo di ritorno del core NON è forzato)
    const raw = computeSynastryAspects(userPoints, personPoints) as unknown;

    // Normalizzo a { p1, p2, aspect, orb }
    const aspects: SynAspect[] = Array.isArray(raw)
      ? (raw.map((x) => toSynAspect(x)).filter((a): a is SynAspect => a !== null))
      : [];

    // Persistenza opzionale
    if (persist) {
      const del = await supabase
        .from('synastry_aspects')
        .delete()
        .eq('user_id', userId)
        .eq('person_id', person_id);
      if (del.error) {
        return NextResponse.json({ error: del.error.message, stage: 'delete' }, { status: 500 });
      }
      if (aspects.length > 0) {
        const rows = aspects.map((a) => ({
          user_id: userId,
          person_id,
          p_user: a.p1,
          p_person: a.p2,
          aspect: a.aspect,
          orb: a.orb,
        }));
        const ins = await supabase.from('synastry_aspects').insert(rows);
        if (ins.error) {
          return NextResponse.json({ error: ins.error.message, stage: 'insert' }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ ok: true, count: aspects.length, aspects });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err?.message ?? 'unknown' }, { status: 500 });
  }
}
