// FILE: src/app/lab/transits-pro/page.tsx
import { Suspense } from "react";
import ClientTransitsPro from "./ClientTransitsPro";
import { computeDailyPlanets } from "@/lib/planets/runtime";
import { createSupabaseServerComponentClient } from "@/lib/supabaseServer";
import { computeHousesForDateUTC } from "@/lib/houses/runtime";

// ---------------------------
// Tipi locali (adattatore)
// ---------------------------

type RuntimePlanet = {
  name: string;
  longitude: number;
  retro?: boolean;
  sign?: string | null;
};

export type ProPoint = {
  id: string;
  name: string;
  lon: number;
  retro?: boolean;
  sign?: string | null;
};

type HouseSystem = "placidus" | "whole";

// Caching leggero
export const revalidate = 60;

// ---------------------------
// Loader pianeti natali da DB: chart_points
// ---------------------------

async function loadNatalForUser() {
  const supabase = createSupabaseServerComponentClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { natal: [] as ProPoint[], missingReason: "not_logged" as const };
  }

  const { data, error } = await supabase
    .from("chart_points")
    .select("name, longitude, sign, house, retro")
    .eq("user_id", user.id);

  if (error) {
    return { natal: [] as ProPoint[], missingReason: "db_error" as const };
  }

  if (!data || data.length === 0) {
    return { natal: [] as ProPoint[], missingReason: "no_points" as const };
  }

  const natal: ProPoint[] = data
    .filter((row) => typeof row.longitude === "number" && row.name)
    .map((row) => ({
      id: row.name,
      name: row.name,
      lon: ((row.longitude % 360) + 360) % 360,
      retro: !!row.retro,
      sign: row.sign ?? null,
    }));

  return { natal, missingReason: null as null };
}

// ---------------------------
// Loader house cusps (natal) dal runtime case
// ---------------------------

async function loadNatalHouses() {
  const supabase = createSupabaseServerComponentClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { cusps: undefined as number[] | undefined, reason: "not_logged" as const };

  // Sistema case da user_prefs
  const { data: prefs } = await supabase
    .from("user_prefs")
    .select("house_system")
    .eq("user_id", user.id)
    .maybeSingle();

  const system = (prefs?.house_system ?? "placidus") as HouseSystem;

  // Dati di nascita (UTC + luogo) — adatta al tuo schema reale
  const { data: birth } = await supabase
    .from("birth_data")
    .select("date, lat, lon")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!birth?.date || birth.lat == null || birth.lon == null) {
    return { cusps: undefined, reason: "no_birth_data" as const };
  }

  const houses = await computeHousesForDateUTC({
    system,
    dateUTC: new Date(birth.date),
    latDeg: birth.lat,
    lonDeg: birth.lon,
  });

  const cusps =
    houses?.cusps && Array.isArray(houses.cusps) && houses.cusps.length >= 12
      ? houses.cusps.slice(0, 12).map((d: number) => ((d % 360) + 360) % 360)
      : undefined;

  return { cusps, reason: null as null };
}

// ---------------------------
// Loader transiti di oggi
// ---------------------------

async function loadToday() {
  const nowUTC = new Date();
  const todayRaw: RuntimePlanet[] = await computeDailyPlanets(nowUTC);
  const today: ProPoint[] = todayRaw.map((p) => ({
    id: p.name,
    name: p.name,
    lon: p.longitude,
    retro: !!p.retro,
    sign: p.sign ?? null,
  }));
  return today;
}

// ---------------------------
// Page (Server Component)
// ---------------------------

export default async function Page() {
  const [today, natalRes, housesRes] = await Promise.all([
    loadToday(),
    loadNatalForUser(),
    loadNatalHouses(),
  ]);

  const { natal, missingReason } = natalRes;
  const { cusps: houseCusps, reason: housesReason } = housesRes;

  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Caricamento Transits…</div>}>
      <ClientTransitsPro today={today} natal={natal} houseCusps={houseCusps} />

      {(missingReason || housesReason) && (
        <div className="mx-auto mt-4 max-w-5xl px-4 space-y-2">
          {missingReason === "not_logged" && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              Accedi per vedere i tuoi pianeti natali e le case nella ruota dei transiti.
            </div>
          )}
          {missingReason === "no_points" && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              Nessun punto natale trovato in <em>chart_points</em>.
            </div>
          )}
          {missingReason === "db_error" && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
              Errore nel caricamento dei punti natali. Riprova più tardi.
            </div>
          )}
          {housesReason === "no_birth_data" && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              Dati di nascita mancanti: imposta data/ora/luogo di nascita per calcolare le case (sistema: da <code>user_prefs.house_system</code>).
            </div>
          )}
        </div>
      )}
    </Suspense>
  );
}
