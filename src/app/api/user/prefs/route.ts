import { NextResponse } from 'next/server';
import { createSupabaseServerRouteClient } from '@/lib/supabaseServer';
import { tzNameFromLatLon } from '@/lib/geo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const supabase = createSupabaseServerRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

    const body: unknown = await req.json().catch(() => ({}));
    const b = (body ?? {}) as Record<string, unknown>;
    const current_place_name = typeof b.current_place_name === 'string' ? b.current_place_name : null;
    const current_lat = Number(b.current_lat);
    const current_lon = Number(b.current_lon);
    let current_tz_name = (typeof b.current_tz_name === 'string' && b.current_tz_name) ? String(b.current_tz_name) : null;

    if (!current_place_name || !Number.isFinite(current_lat) || !Number.isFinite(current_lon)) {
      return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
    }

    if (!current_tz_name) {
      current_tz_name = tzNameFromLatLon(current_lat, current_lon) || 'UTC';
    }

    const { error } = await supabase
      .from('user_prefs')
      .upsert({
        user_id: user.id,
        current_place_name,
        current_lat,
        current_lon,
        current_tz_name,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (process.env.NODE_ENV !== 'production') console.error('[user/prefs] ERROR:', err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
