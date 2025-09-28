// src/app/api/debug/whoami/route.ts
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function GET() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // Nelle route App Router non impostiamo cookie (no-op):
        set() { /* no-op */ },
        remove() { /* no-op */ },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    return Response.json({ user: null, error: error.message }, { status: 401 });
  }
  if (!user) {
    return Response.json({ user: null, error: 'Auth session missing!' }, { status: 200 });
  }
  return Response.json({ user, error: null }, { status: 200 });
}
