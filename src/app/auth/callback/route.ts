// src/app/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { createSupabaseServerRouteClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/onboarding#birth';

  // Scambia il "code" per una sessione (PKCE / Email OTP v2)
  if (code) {
    const supabase = createSupabaseServerRouteClient();
    try {
      await supabase.auth.exchangeCodeForSession(code);
    } catch {
      // fallback: continua comunque il redirect; l'utente potrà loggarsi manualmente
    }
  }

  // Redirigi alla pagina di raccolta dati
  const dest = new URL(next, url.origin);
  return NextResponse.redirect(dest);
}
