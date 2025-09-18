// src/app/api/auth/signout/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerComponentClient } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerComponentClient();
  await supabase.auth.signOut(); // gestisce i cookie lato server handler
  const origin = new URL(req.url).origin;
  return NextResponse.redirect(`${origin}/onboarding`, { status: 303 });
}
