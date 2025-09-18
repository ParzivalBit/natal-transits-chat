// src/app/api/interpret/transits/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Focus = 'work' | 'relationships' | 'energy';
type Lang = 'en' | 'it' | 'es' | 'pt';

function sanitizeFocus(input: unknown): Focus[] {
  const allowed: Focus[] = ['work', 'relationships', 'energy'];
  if (!Array.isArray(input)) return [];
  return input.filter((v): v is Focus => typeof v === 'string' && allowed.includes(v as Focus));
}

function sanitizeLang(input: unknown): Lang {
  const allowed: Lang[] = ['en', 'it', 'es', 'pt'];
  return (typeof input === 'string' && (allowed as string[]).includes(input)) ? (input as Lang) : 'en';
}

function sanitizeLimit(input: unknown): number {
  const n = Number(input);
  if (!Number.isFinite(n)) return 5;
  const int = Math.trunc(n);
  return Math.min(7, Math.max(1, int));
}

function sanitizeDate(input: unknown): string {
  const today = new Date().toISOString().slice(0, 10);
  if (typeof input !== 'string') return today;
  return /^\d{4}-\d{2}-\d{2}$/.test(input) ? input : today;
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json().catch(() => ({}));

    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[interpret/transits] request body:', body);
    }

    const b = (body ?? {}) as Record<string, unknown>;

    const user_id = (typeof b.user_id === 'string' && b.user_id.length > 0)
      ? b.user_id
      : process.env.DEV_USER_ID;

    if (!user_id) {
      return NextResponse.json({ ok: false, error: 'Missing user_id or DEV_USER_ID' }, { status: 400 });
    }

    const date = sanitizeDate(b.date);
    const focus = sanitizeFocus(b.focus);
    const lang = sanitizeLang(b.lang);
    const limit = sanitizeLimit(b.limit);

    // Import dinamici per evitare problemi di bundling
    const { composeTransitsSkeleton, refineTransitText } = await import('@/lib/composer');

    const skeleton = await composeTransitsSkeleton(user_id, date, limit);
    const text = await refineTransitText(skeleton, focus, lang);

    return NextResponse.json({ ok: true, date: skeleton.date, text, skeleton });
  } catch (err: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[interpret/transits] ERROR:', err);
    }
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
