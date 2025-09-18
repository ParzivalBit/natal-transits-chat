// src/app/dashboard/layout.tsx
import Link from 'next/link';
import { ReactNode } from 'react';
import { createSupabaseServerComponentClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = createSupabaseServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/onboarding');

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-semibold">Natal + Transits + Chat</div>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/dashboard/natal" className="rounded px-3 py-2 hover:bg-gray-50">Natal</Link>
            <Link href="/dashboard/transits" className="rounded px-3 py-2 hover:bg-gray-50">Transits</Link>
            <Link href="/onboarding" className="rounded px-3 py-2 hover:bg-gray-50">Onboarding</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
