import dynamicImport from 'next/dynamic';
import { createSupabaseServerComponentClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { systemChat } from '@/ai/systemPrompts';

export const dynamic = 'force-dynamic';

const ChartWheel = dynamicImport(() => import('@/components/ChartWheel'), { ssr: false });
const ChatUI = dynamicImport(() => import('@/components/ChatUI'), { ssr: false });

// Solo il tipo usato da ChartWheel
import type { ChartPoint as WheelPoint } from '@/components/ChartWheel';

type RawPoint = {
  name?: unknown;
  longitude?: unknown;
  sign?: unknown;
  house?: unknown;
  retro?: unknown;
};

export default async function PersonDetailPage({ params }: { params: { id: string } }) {
  // Auth
  const supabase = createSupabaseServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/onboarding');

  const id = params.id;

  // Persona
  const { data: person } = await supabase
    .from('people')
    .select('label')
    .eq('user_id', user.id)
    .eq('id', id)
    .maybeSingle();
  if (!person) redirect('/dashboard/people');

  // Punti del tema di quella persona
  const { data: pointsRaw } = await supabase
    .from('people_chart_points')
    .select('name,longitude,sign,house,retro')
    .eq('person_id', id)
    .order('name', { ascending: true });

  // Normalizzazione per ChartWheel
  const chartPoints: WheelPoint[] = Array.isArray(pointsRaw)
    ? (pointsRaw as RawPoint[]).map((p) => ({
        name: String(p.name ?? ''),
        longitude: Number(p.longitude ?? 0),
        sign: String(p.sign ?? ''),                 // mai null
        house: (p.house ?? null) as number | null,
        retro: Boolean(p.retro),
      }))
    : [];

  // Costruisco URL assoluta e inoltro i cookie per evitare 401
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const baseUrl = `${proto}://${host}`;
  const cookie = h.get('cookie') ?? '';

  // Chiamo /api/compat/[id] per ottenere il contesto
  let initialContext = '';
  try {
    const res = await fetch(`${baseUrl}/api/compat/${id}`, {
      cache: 'no-store',
      headers: { cookie },
    });
    if (res.ok) {
      const json = await res.json();
      initialContext = json?.context || '';
    }
  } catch {
    // fallback: nessun contesto
  }

  // 👉 systemPrompt va costruito QUI, dopo aver ottenuto initialContext
  const systemPrompt = [systemChat?.trim() || '', initialContext.trim()]
    .filter(Boolean)
    .join('\n\n');

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="rounded-2xl border p-4">
        <h2 className="text-lg font-semibold mb-3">{person.label}: Natal Chart</h2>
        {chartPoints.length > 0 ? (
          <ChartWheel points={chartPoints} />
        ) : (
          <div className="text-sm text-gray-600">Nessun dato calcolato.</div>
        )}
      </div>

      <div className="rounded-2xl border p-4 min-h-[480px]">
        <h2 className="text-lg font-semibold mb-3">Chat di coppia/team</h2>
        <div className="h-[75vh]">
          <ChatUI initialContext={initialContext} systemPrompt={systemPrompt} />
        </div>
        <p className="mt-2 text-xs text-gray-500">
          La chat usa: natal utente + natal {person.label}, top sinastria e i transiti di oggi combinati.
        </p>
      </div>
    </div>
  );
}
