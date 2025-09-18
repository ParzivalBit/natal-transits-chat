// src/app/api/auth/signout/route.ts
import { NextResponse } from 'next/server';
import { createSupabaseServerRouteClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  try {
    const supabase = createSupabaseServerRouteClient();
    const { error } = await supabase.auth.signOut();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
