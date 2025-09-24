// FILE: src/app/lab/daily-pro/loadData.ts
import {
  ASPECTS,
  acuteDelta,
  closestAspectDelta,
  maxOrbForPair,
  PointName,
  Point,
} from "../../../lib/aspects";
import { createSupabaseServerComponentClient } from "../../../lib/supabaseServer";
import { computePlanetsAtUTC } from "../../../lib/planets/runtime";

export type HouseSystem = "whole" | "placidus";

export type DailyData = {
  houseSystem: HouseSystem;
  natalPoints: Point[];
  natalCusps: number[];
  todayPoints: Point[];
  todayCusps: number[];
  transitingAspects: Array<{
    t: PointName;
    n: PointName;
    aspect: keyof typeof ASPECTS;
    orb: number;
  }>;
  dateISO: string;
};

export async function loadDaily(): Promise<DailyData> {
  const sb = createSupabaseServerComponentClient();

  // Auth
  const {
    data: { user },
    error: uerr,
  } = await sb.auth.getUser();
  if (uerr || !user) throw new Error("Not authenticated");

  // Preferenze
  const { data: prefs, error: perr } = await sb
    .from("user_prefs")
    .select("house_system, current_lat, current_lon")
    .eq("user_id", user.id)
    .single();
  if (perr) throw new Error(perr.message);

  const houseSystem: HouseSystem = (prefs?.house_system as HouseSystem) || "whole";

  // Punti natali
  const { data: natalPoints, error: nperr } = await sb
    .from("chart_points")
    .select("name, longitude, retro")
    .eq("user_id", user.id);
  if (nperr) throw new Error(nperr.message);

  // Case natali
  const { data: cuspsRow } = await sb
    .from("house_cusps")
    .select("c1,c2,c3,c4,c5,c6,c7,c8,c9,c10,c11,c12")
    .eq("user_id", user.id)
    .eq("house_system", houseSystem)
    .maybeSingle();

  const natalCusps: number[] = cuspsRow
    ? [
        cuspsRow.c1,
        cuspsRow.c2,
        cuspsRow.c3,
        cuspsRow.c4,
        cuspsRow.c5,
        cuspsRow.c6,
        cuspsRow.c7,
        cuspsRow.c8,
        cuspsRow.c9,
        cuspsRow.c10,
        cuspsRow.c11,
        cuspsRow.c12,
      ]
    : [];

  // Data corrente
  const now = new Date();
  const dateISO = now.toISOString().slice(0, 10);

  // Pianeti runtime
  const todayPoints = computePlanetsAtUTC(now).map((p) => ({
    name: p.name,
    longitude: p.longitude,
    retro: p.retro,
  })) as Point[];

  // Fallback: todayCusps = natalCusps (fino a che non colleghiamo calcolo runtime case)
  const todayCusps = natalCusps;

  // Aspetti transiting → natal
  const aspectList: DailyData["transitingAspects"] = [];
  for (const t of todayPoints) {
    const tn = t.name as PointName;
    if (
      ![
        "Sun",
        "Moon",
        "Mercury",
        "Venus",
        "Mars",
        "Jupiter",
        "Saturn",
        "Uranus",
        "Neptune",
        "Pluto",
      ].includes(tn)
    )
      continue;

    for (const n of (natalPoints as unknown as Point[]) ?? []) {
      const nn = n.name as PointName;
      const delta = acuteDelta(t.longitude, n.longitude);
      const hit = closestAspectDelta(delta);
      const max = maxOrbForPair(tn, nn, hit.aspect.key);
      if (hit.orb <= max) {
        aspectList.push({
          t: tn,
          n: nn,
          aspect: hit.aspect.key,
          orb: +hit.orb.toFixed(2),
        });
      }
    }
  }

  return {
    houseSystem,
    natalPoints: (natalPoints as unknown as Point[]) ?? [],
    natalCusps,
    todayPoints,
    todayCusps,
    transitingAspects: aspectList,
    dateISO,
  };
}
