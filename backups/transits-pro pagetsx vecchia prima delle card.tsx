// FILE: src/app/lab/transits-pro/page.tsx
import { Suspense } from "react";
import ClientTransitsPro from "./ClientTransitsPro";
import { computeDailyPlanets } from "@/lib/planets/runtime";
import { createSupabaseServerComponentClient } from "@/lib/supabaseServer";
import { computeHousesForDateUTC } from "@/lib/houses/runtime";

type HouseSystem = "placidus" | "whole";

type RuntimePlanet = {
  name: string;
  longitude: number;
  retro?: boolean;
  sign?: string | null;
};

export type ProPoint = {
  id: string;
  name: string;
  lonDeg: number;
  kind: "natal" | "transit";
  retro?: boolean;
  sign?: string | null;
};

// cache soft
export const revalidate = 60;

// ---------------------------
// Loader pianeti natali da DB
// ---------------------------
async function loadNatalForUser(): Promise<{ natal: ProPoint[]; reason: string | null }> {
  const supabase = createSupabaseServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { natal: [], reason: "not_logged" };

  const { data, error } = await supabase
    .from("chart_points")
    .select("name, longitude, sign, retro")
    .eq("user_id", user.id);

  if (error) return { natal: [], reason: "db_error" };
  if (!data || data.length === 0) return { natal: [], reason: "no_points" };

  const natal: ProPoint[] = data
    .filter(r => typeof r.longitude === "number" && r.name)
    .map(r => ({
      id: r.name,
      name: r.name,
      lonDeg: ((r.longitude % 360) + 360) % 360,
      kind: "natal",
      retro: !!r.retro,
      sign: r.sign ?? null,
    }));

  return { natal, reason: null };
}

// ---------------------------
// Loader house cusps (natal)
// ---------------------------
async function loadNatalHouses(systemOverride?: HouseSystem): Promise<{
  cusps?: number[];
  systemShown: HouseSystem | null;
  reason: string | null;
}> {
  const supabase = createSupabaseServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { cusps: undefined, systemShown: null, reason: "not_logged" };

  const { data: prefs } = await supabase
    .from("user_prefs")
    .select("house_system")
    .eq("user_id", user.id)
    .maybeSingle();

  const system: HouseSystem = (systemOverride ?? (prefs?.house_system ?? "placidus")) as HouseSystem;

  const { data: birth } = await supabase
    .from("birth_data")
    .select("date, lat, lon")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!birth?.date || birth.lat == null || birth.lon == null) {
    return { cusps: undefined, systemShown: system, reason: "no_birth_data" };
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

  return { cusps, systemShown: system, reason: null };
}

// ---------------------------
// Loader transiti di oggi
// ---------------------------
async function loadToday(): Promise<ProPoint[]> {
  const nowUTC = new Date();
  const raw: RuntimePlanet[] = await computeDailyPlanets(nowUTC);
  return raw.map(p => ({
    id: p.name,
    name: p.name,
    lonDeg: ((p.longitude % 360) + 360) % 360,
    kind: "transit",
    retro: !!p.retro,
    sign: p.sign ?? null,
  }));
}

// ---------------------------
// Page
// ---------------------------
export default async function Page({
  searchParams,
}: {
  searchParams?: { house?: string };
}) {
  const houseQuery = (searchParams?.house ?? "").toLowerCase();
  const override: HouseSystem | undefined =
    houseQuery === "whole" ? "whole" : houseQuery === "placidus" ? "placidus" : undefined;

  const [today, natalRes, housesRes] = await Promise.all([
    loadToday(),
    loadNatalForUser(),
    loadNatalHouses(override),
  ]);

  const { natal, reason: natalReason } = natalRes;
  const { cusps: houseCusps, systemShown, reason: housesReason } = housesRes;

  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Caricamento Transits…</div>}>
      <ClientTransitsPro
        today={today}
        natal={natal}
        houseCusps={houseCusps}
        houseSystemShown={systemShown ?? undefined}
      />

      {(natalReason || housesReason) && (
        <div className="mx-auto mt-4 max-w-5xl px-4 space-y-2">
          {natalReason === "not_logged" && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              Accedi per vedere i tuoi pianeti natali e le case nella ruota dei transiti.
            </div>
          )}
          {natalReason === "no_points" && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              Nessun punto natale trovato in <em>chart_points</em>.
            </div>
          )}
          {natalReason === "db_error" && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
              Errore nel caricamento dei punti natali. Riprova.
            </div>
          )}
          {housesReason === "no_birth_data" && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              Dati di nascita mancanti: imposta data/ora/luogo per calcolare le case (di default da <code>user_prefs.house_system</code>).
            </div>
          )}
        </div>
      )}
    </Suspense>
  );
}
