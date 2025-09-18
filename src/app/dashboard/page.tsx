// src/app/dashboard/page.tsx
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerComponentClient } from '@/lib/supabaseServer';
import ChatUI from '@/components/ChatUI';

export default async function DashboardHub() {
  const supabase = createSupabaseServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/onboarding');

  const cards: Array<{ href: string; title: string; emoji: string; desc: string }> = [
    { href: '/dashboard/natal',    title: 'Natal Chart',       emoji: '🗺️', desc: 'Il tuo tema natale con ruota e chat contestuale.' },
    { href: '/dashboard/transits', title: 'Transits',          emoji: '🛰️', desc: 'Transiti di oggi e del mese con azioni pratiche.' },
    { href: '/dashboard/daily',    title: 'Daily Horoscope',   emoji: '📅', desc: 'Mappa del cielo del giorno, navigazione date + chat.' },
    { href: '/dashboard/moon',     title: 'Moon',              emoji: '🌙', desc: 'Fase lunare e segno della Luna, consigli quotidiani.' },
  ];

  const initialContext =
`GENERAL_CONTEXT
You are the app's assistant. The user can ask about today's horoscope, personal transits, natal chart, or the Moon.
- If they say "today", infer the date/timezone from user_prefs when possible.
- Focus on work/relationships/energy with realistic, practical suggestions (2–3).
- Avoid absolutes. Wellbeing/entertainment disclaimer.`;

  return (
    <div className="p-6 space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/onboarding"
            className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50"
          >
            Profilo
          </Link>
          <form action="/api/auth/signout" method="post">
            <button className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50">
              Sign out
            </button>
          </form>
        </div>
      </div>

      {/* Grid 2x2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-2xl border p-5 hover:shadow-sm transition"
          >
            <div className="flex items-center gap-3">
              <div className="text-3xl">{c.emoji}</div>
              <div>
                <div className="text-base font-semibold">{c.title}</div>
                <div className="text-sm text-gray-600">{c.desc}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Chat generale */}
      <div className="rounded-2xl border p-4">
        <div className="mb-2 text-sm font-medium">Chat</div>
        <div className="h-[70vh]">
          <ChatUI initialContext={initialContext} />
        </div>
      </div>
    </div>
  );
}
