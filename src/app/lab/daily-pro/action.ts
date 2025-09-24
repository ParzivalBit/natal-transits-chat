// FILE: src/app/lab/daily-pro/action.ts
"use server";

import { createSupabaseServerComponentClient } from "../../../lib/supabaseServer";
import type { DailyData } from "./loadData";

// Mappa dai codici interni (conj, sq, tri, opp, sext) ai valori DB
const DB_ASPECTS: Record<string, string> = {
  conj: "conjunction",
  sext: "sextile",
  sq: "square",
  tri: "trine",
  opp: "opposition",
};

export async function upsertTransitDay(
  payload: Pick<DailyData, "transitingAspects" | "dateISO">
) {
  const sb = createSupabaseServerComponentClient();

  const {
    data: { user },
    error: uerr,
  } = await sb.auth.getUser();
  if (uerr || !user) throw new Error("Not authenticated");

  // Cancella record già presenti per la data
  const del = await sb
    .from("transit_events")
    .delete()
    .eq("user_id", user.id)
    .eq("date", payload.dateISO);
  if (del.error) throw new Error(del.error.message);

  if (!payload.transitingAspects?.length) {
    return { ok: true, inserted: 0 };
  }

  const rows = payload.transitingAspects.map((a) => {
    const aspectKey = DB_ASPECTS[a.aspect] ?? "conjunction"; // fallback safe
    return {
      user_id: user.id,
      date: payload.dateISO,
      t_planet: a.t,
      n_point: a.n,
      aspect: aspectKey,
      orb: a.orb,
      score: Math.max(1, Math.round(100 - a.orb * 10)),
    };
  });

  const ins = await sb.from("transit_events").insert(rows);
  if (ins.error) throw new Error(ins.error.message);

  return { ok: true, inserted: rows.length };
}
