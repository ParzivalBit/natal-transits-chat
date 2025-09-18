// src/app/dashboard/natal/page.tsx
import { createSupabaseServerComponentClient } from '@/lib/supabaseServer';
import dynamicImport from 'next/dynamic';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type ChartPoint = {
  name: string;
  longitude: number;
  sign: string;
  house: number | null;
  retro: boolean;
};

// Carichiamo i componenti client solo lato client (no SSR) per evitare mismatch
const ChartWheel = dynamicImport<{ points: ChartPoint[] }>(
  () => import('@/components/ChartWheel'),
  { ssr: false }
);
const ChatUI = dynamicImport(() => import('@/components/ChatUI'), { ssr: false });

export default async function Page() {
  const supabase = createSupabaseServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/onboarding');

  const { data: points } = await supabase
    .from('chart_points')
    .select('name,longitude,sign,house,retro')
    .eq('user_id', user.id)
    .order('name', { ascending: true });

  const hasPoints = Array.isArray(points) && points.length > 0;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="rounded-2xl border p-4">
        <h2 className="text-lg font-semibold mb-3">Natal Chart (Whole Sign)</h2>
        {hasPoints ? (
          <ChartWheel points={points as ChartPoint[]} />
        ) : (
          <p className="text-sm text-gray-600">
            Nessun dato. Vai in <span className="font-medium">Onboarding</span> e salva i dati di nascita.
          </p>
        )}
        <p className="mt-2 text-xs text-gray-500">
          House system: Whole Sign (MVP). Le case possono differire da sistemi come Placidus.
        </p>
      </div>

      <div className="rounded-2xl border p-4 min-h-[480px]">
        <h2 className="text-lg font-semibold mb-3">Ask about your chart</h2>
        <ChatUI />
      </div>
    </div>
  );
}
