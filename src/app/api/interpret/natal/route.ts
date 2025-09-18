// src/app/api/interpret/natal/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    // Import dinamici per evitare problemi di bundling/edge
    const { z } = await import('zod');
    const { composeNatalSkeleton, refineNatalText } = await import('@/lib/composer');

    const BodySchema = z.object({
      user_id: z.string().uuid().optional(),
      focus: z.array(z.enum(['work','relationships','energy'])).optional().default([]),
      lang: z.enum(['en','it','es','pt']).optional().default('en'),
    });

    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
    }

    const user_id = parsed.data.user_id ?? process.env.DEV_USER_ID;
    if (!user_id) return NextResponse.json({ ok: false, error: 'Missing user_id or DEV_USER_ID' }, { status: 400 });

    const skeleton = await composeNatalSkeleton(user_id);
    const text = await refineNatalText(skeleton, parsed.data.focus, parsed.data.lang);

    return NextResponse.json({ ok: true, text, skeleton });
  } catch (err: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[interpret/natal] ERROR:', err);
    }
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
