// src/lib/supabaseServer.ts
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

function getSupabaseUrlAndKey() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    '';
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';
  if (!url || !anon) {
    throw new Error(
      "Your project's URL and Key are required to create a Supabase client!\n" +
      'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
    );
  }
  return { url, anon };
}

/** Da usare in Server Components (RSC): NESSUNA mutazione cookie */
export function createSupabaseServerComponentClient() {
  const cookieStore = cookies();
  const { url, anon } = getSupabaseUrlAndKey();

  return createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      // set/remove NON disponibili in RSC: no-op per evitare errori
      set() {},
      remove() {},
    },
  });
}

/** Da usare SOLO in Route Handlers / Server Actions: può mutare cookie */
export function createSupabaseServerRouteClient() {
  const cookieStore = cookies();
  const { url, anon } = getSupabaseUrlAndKey();

  return createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.set({ name, value: '', ...options });
      },
    },
  });
}
