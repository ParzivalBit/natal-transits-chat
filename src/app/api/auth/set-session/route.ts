// src/app/api/auth/set-session/route.ts
import { NextResponse } from 'next/server';
import { createSupabaseServerRouteClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { access_token, refresh_token } = (await req.json()) as {
      access_token?: string;
      refresh_token?: string;
    };

    if (!access_token || !refresh_token) {
      return NextResponse.json({ ok: false, error: 'Missing tokens' }, { status: 400 });
    }

    const supabase = createSupabaseServerRouteClient();
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}


// Facciamo rispondere qualcosa anche al GET, così puoi testare velocemente se la route esiste.
export async function GET() {
  return NextResponse.json({ ok: false, error: 'Use POST' }, { status: 405 });
}