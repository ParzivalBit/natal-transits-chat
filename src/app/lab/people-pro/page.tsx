// src/app/lab/people-pro/page.tsx
import nextDynamic from 'next/dynamic';
import { createSupabaseServerComponentClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';

const SynastryWheelPro = nextDynamic(() => import('@/components/astro/SynastryWheelPro'), { ssr: false });

export const dynamic = 'force-dynamic';

interface ChartPoint {
  name: string;
  longitude: number;
  sign: string;
  house?: number | null;
  retro?: boolean | null;
}

export default async function Page() {
  const supabase = createSupabaseServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/onboarding');

  const { data: natalRows } = await supabase
    .from('chart_points')
    .select('name,longitude,sign')
    .eq('user_id', user.id)
    .order('name');

  const a: ChartPoint[] = Array.isArray(natalRows)
    ? natalRows.map((p: unknown) => {
        const obj = p as { name: string; longitude: number; sign: string | null };
        return {
          name: String(obj.name),
          longitude: Number(obj.longitude),
          sign: String(obj.sign ?? ''),
        };
      })
    : [];

  const { data: people } = await supabase
    .from('people')
    .select('id,label')
    .eq('user_id', user.id)
    .order('created_at')
    .limit(1);

  let b: ChartPoint[] = [];
  let label = 'Partner (first saved)';

  if (people && people.length > 0) {
    const pid = people[0].id;
    label = String(people[0].label || label);

    const { data: pointsRaw } = await supabase
      .from('people_chart_points')
      .select('name,longitude,sign')
      .eq('person_id', pid)
      .order('name');

    b = Array.isArray(pointsRaw)
      ? pointsRaw.map((p: unknown) => {
          const obj = p as { name: string; longitude: number; sign: string | null };
          return {
            name: String(obj.name),
            longitude: Number(obj.longitude),
            sign: String(obj.sign ?? ''),
          };
        })
      : [];
  }

  return (
    <div className="p-6 space-y-3">
      <h1 className="text-xl font-semibold">Lab · People/Synastry Pro</h1>
      {b.length === 0 ? (
        <div className="rounded-xl border p-4 text-sm text-gray-700">
          Nessuna persona salvata. Vai su <code>/dashboard/people</code> e aggiungine una per testare la sinastria.
        </div>
      ) : (
        <SynastryWheelPro title={`Synastry · You + ${label}`} a={a} b={b} />
      )}
    </div>
  );
}
