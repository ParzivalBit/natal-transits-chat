// src/app/page.tsx
import Link from 'next/link';
import { createSupabaseServerComponentClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = createSupabaseServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();

  const ctaHref = user ? '/dashboard' : '/onboarding';

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-3xl text-center space-y-6">
        <h1 className="text-3xl font-bold">Il tuo astrologo AI tascabile</h1>
        <p className="text-gray-600">
          Tema natale, transiti quotidiani/settimanali, e una chat AI che conosce la tua carta.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href={ctaHref}
            className="rounded-xl bg-blue-600 text-white px-5 py-3 hover:bg-blue-700"
          >
            Get Started
          </Link>
          <Link
            href="/onboarding"
            className="rounded-xl border px-5 py-3 hover:bg-gray-50"
          >
            Onboarding
          </Link>
        </div>
        <p className="text-xs text-gray-500">
          Benessere/entertainment. Non sostituisce consigli medici/legali/finanziari.
        </p>
      </div>
    </main>
  );
}
