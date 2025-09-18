import Link from 'next/link';
import { createSupabaseServerComponentClient } from '@/lib/supabaseServer';
import AuthForm from '@/components/AuthForm';
import BirthSection from '@/components/BirthSection';
import CurrentLocationForm from '@/components/CurrentLocationForm';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const supabase = createSupabaseServerComponentClient();

  // Auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <main className="max-w-3xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-semibold">Get started</h1>
        <p className="text-sm text-gray-600">
          Create an account or sign in to save your chart and preferences.
        </p>
        <AuthForm />
      </main>
    );
  }

  // Dati salvati
  const { data: birth } = await supabase
    .from('birth_data')
    .select('name,date,time,place_name,lat,lon')
    .eq('user_id', user.id)
    .maybeSingle();

  const { data: prefs } = await supabase
    .from('user_prefs')
    .select('current_place_name,current_lat,current_lon,current_tz_name')
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Onboarding</h1>
        <Link href="/dashboard" className="text-sm rounded border px-3 py-2 hover:bg-gray-50">
          Go to dashboard
        </Link>
      </header>

      {/* Top bar azioni account */}
        {user ? (
        <div className="mb-4 flex items-center justify-end">
          <form action="/api/auth/signout" method="post">
             <button className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50">
             Sign out
             </button>
          </form>
        </div>
        ) : null}


      {/* Birth section gestita da client component (legge ?edit=birth) */}
      <section id="birth" className="space-y-3">
        <h2 className="text-lg font-medium">Birth data</h2>
        <BirthSection
          birth={{
            name: birth?.name ?? '',
            date: birth?.date ?? '',
            time: birth?.time ?? '',
            place_name: birth?.place_name ?? '',
            lat: birth?.lat ?? null,
            lon: birth?.lon ?? null,
          }}
        />
      </section>

      {/* Current Location */}
      <section id="location" className="space-y-3">
        <h2 className="text-lg font-medium">Current location (for transits)</h2>
        <CurrentLocationForm
          initial={{
            place_name: prefs?.current_place_name ?? '',
            lat: prefs?.current_lat ?? null,
            lon: prefs?.current_lon ?? null,
            tz_name: prefs?.current_tz_name ?? '',
          }}
        />
      </section>
    </main>
  );
}
