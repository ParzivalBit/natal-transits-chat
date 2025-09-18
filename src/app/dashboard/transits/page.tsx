// src/app/dashboard/transits/page.tsx
import { createSupabaseServerComponentClient } from '@/lib/supabaseServer';
import TransitsToday from '@/components/TransitsToday';
import ChatUI from '@/components/ChatUI';

export const dynamic = 'force-dynamic';

function todayUTCISO(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default async function TransitsPage() {
  const supabase = createSupabaseServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="text-sm text-gray-600">
        Devi autenticarti. Vai su <a className="underline" href="/onboarding">Onboarding</a>.
      </div>
    );
  }

  const dateUTC = todayUTCISO();

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="rounded-2xl border p-4">
        <h2 className="text-lg font-semibold mb-3">Top transits di oggi</h2>
        <TransitsToday />
        <p className="mt-2 text-xs text-gray-500">
          Calcolo giornaliero in UTC. La chat a destra userà la stessa data di questa lista.
        </p>
      </div>

      <div className="rounded-2xl border p-4 min-h-[480px]">
        <h2 className="text-lg font-semibold mb-3">Ask about today</h2>
        <ChatUI context={{ view: 'transits', dateUTC }} />
      </div>
    </div>
  );
}
