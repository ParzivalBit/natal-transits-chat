// src/app/dashboard/moon/page.tsx
import { redirect } from 'next/navigation';
import { DateTime } from 'luxon';
import * as Astronomy from 'astronomy-engine';
import { createSupabaseServerComponentClient } from '@/lib/supabaseServer';
import { signFromLongitude, normalizeDeg } from '@/lib/astro';
import MoonPhaseCard from '@/components/MoonPhaseCard';
import ChatUI from '@/components/ChatUI';

const OBLIQUITY = (23.4392911 * Math.PI) / 180; // rad

function rad(d: number) { return (d * Math.PI) / 180; }
function deg(r: number) { return (r * 180) / Math.PI; }

function eclipticFromEquatorial(eq: Astronomy.EquatorialCoordinates): { elon: number; elat: number } {
  const ra = eq.ra * 15; // h → deg
  const dec = eq.dec;
  const raRad = rad(ra);
  const decRad = rad(dec);
  const sinE = Math.sin(OBLIQUITY);
  const cosE = Math.cos(OBLIQUITY);
  const sinDec = Math.sin(decRad);
  const cosDec = Math.cos(decRad);
  const sinRa = Math.sin(raRad);
  const cosRa = Math.cos(raRad);
  const elat = Math.asin(sinDec * cosE - cosDec * sinE * sinRa);
  const y = sinRa * cosE + Math.tan(decRad) * sinE;
  const x = cosRa;
  const elon = Math.atan2(y, x);
  return { elon: normalizeDeg(deg(elon)), elat: deg(elat) };
}

function geoEclLon(body: Astronomy.Body, date: Date): number {
  const vec = Astronomy.GeoVector(body, date, true);
  const eq = Astronomy.EquatorFromVector(vec);
  const ecl = eclipticFromEquatorial(eq);
  return ecl.elon;
}

function phaseEmojiAndName(elongDeg: number): { emoji: string; name: string } {
  // elongazione Sole→Luna 0..360
  const e = normalizeDeg(elongDeg);
  // 8 fasi “classiche”
  const names = [
    'New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous',
    'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent',
  ];
  const emojis = ['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'];
  const idx = Math.round(((e % 360) / 45)) % 8;
  return { emoji: emojis[idx], name: names[idx] };
}

function buildMoonContext(dateISO: string, sign: string, phaseName: string, illum: number): string {
  const pct = Math.round(illum * 100);
  return `CONTEXT_MOON_DAY
${dateISO}: Moon in ${sign} — ${phaseName} (${pct}% illuminated)

Guidelines:
- Focus on mood, habits, home/family rhythms, intuition and pacing.
- Offer concise, practical moves for the day (2–3), tailored to the sign/phase.
- Avoid absolutes; wellbeing/entertainment.`;
}

export default async function MoonPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const supabase = createSupabaseServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/onboarding');

  // tz utente (se presente)
  const { data: prefs } = await supabase
    .from('user_prefs')
    .select('current_tz_name')
    .eq('user_id', user.id)
    .maybeSingle();

  const tz = prefs?.current_tz_name ?? 'UTC';
  const reqDate = searchParams?.date;
  const dateISO =
    reqDate && /^\d{4}-\d{2}-\d{2}$/.test(reqDate)
      ? reqDate
      : DateTime.now().setZone(tz).toISODate()!;

  const dtLocal = DateTime.fromISO(`${dateISO}T09:00`, { zone: tz }); // 09:00 locale
  const when = dtLocal.toUTC().toJSDate();

  // longitudes
  const sunLon = geoEclLon(Astronomy.Body.Sun, when);
  const moonLon = geoEclLon(Astronomy.Body.Moon, when);

  // elongazione Sole→Luna
  const elong = normalizeDeg(moonLon - sunLon); // 0..360

  // Illuminazione (tipizzata)
  const info = Astronomy.Illumination(Astronomy.Body.Moon, when) as Astronomy.IlluminationInfo;
  const illum = Math.max(0, Math.min(1, info.phase_fraction ?? 0));

  // segno lunare e fase
  const moonSign = signFromLongitude(moonLon);
  const { emoji, name: phaseName } = phaseEmojiAndName(elong);

  // prev/next
  const prev = DateTime.fromISO(dateISO, { zone: tz }).minus({ days: 1 }).toISODate()!;
  const next = DateTime.fromISO(dateISO, { zone: tz }).plus({ days: 1 }).toISODate()!;

  // contesto chat
  const ctx = buildMoonContext(dateISO, moonSign, phaseName, illum);

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Colonna sinistra (2/3): controlli + card Luna */}
        <div className="xl:col-span-2 space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <a
                href={`/dashboard/moon?date=${prev}`}
                className="rounded-lg border px-3 py-1 hover:bg-gray-50"
                title="Giorno precedente"
              >
                ◀
              </a>
              <a
                href={`/dashboard/moon?date=${next}`}
                className="rounded-lg border px-3 py-1 hover:bg-gray-50"
                title="Giorno successivo"
              >
                ▶
              </a>
            </div>

            <form method="get" className="flex items-center gap-2">
              <input
                type="date"
                name="date"
                defaultValue={dateISO}
                className="rounded-lg border px-3 py-1 text-sm"
              />
              <button className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50">
                Vai
              </button>
            </form>
          </header>

          <MoonPhaseCard
            dateISO={dateISO}
            tzName={tz}
            moonSign={moonSign}
            phaseName={phaseName}
            illumination={illum}
            emoji={emoji}
          />
        </div>

        {/* Colonna destra (1/3): Chat sticky con contesto lunare */}
        <div className="xl:col-span-1">
          <div className="sticky top-6 h-[75vh]">
            <ChatUI initialContext={ctx} />
          </div>
        </div>
      </div>
    </div>
  );
}
