// src/app/api/geo/search/route.ts
import { NextResponse } from 'next/server';
import { nominatimSearch } from '@/lib/geo';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();
  const limitRaw = searchParams.get('limit');
  const limit = Number(limitRaw ?? 5);

  if (!q) {
    return NextResponse.json({ error: 'Missing q' }, { status: 400 });
  }

  try {
    const items = await nominatimSearch(q, Number.isFinite(limit) ? limit : 5);
    return NextResponse.json({
      ok: true,
      query: q,
      results: items.map((i) => ({
        place_id: i.place_id,
        display_name: i.display_name,
        name: i.name,
        lat: i.lat,
        lon: i.lon,
        city: i.address?.city,
        state: i.address?.state,
        country: i.address?.country,
        country_code: i.address?.country_code,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
