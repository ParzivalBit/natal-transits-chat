// FILE: src/app/lab/daily-pro/page.tsx
import { Suspense } from "react";
import ClientDailyPro from "./ClientDailyPro";
import { computeDailyPlanets } from "@/lib/planets/runtime";

// ---------------------------
// Tipi locali
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

export const revalidate = 60;

// ---------------------------
// Data loader (server)
// ---------------------------

async function loadDailyData() {
  const nowUTC = new Date();
  const todayRaw: RuntimePlanet[] = await computeDailyPlanets(nowUTC);
  const today: ProPoint[] = todayRaw.map((p) => ({
    id: p.name,
    name: p.name,
    lon: p.longitude,
    retro: !!p.retro,
    sign: p.sign ?? null,
  }));
  return { today };
}

// ---------------------------
// Page (Server Component)
// ---------------------------

export default async function Page() {
  const { today } = await loadDailyData();
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Caricamento Daily Sky…</div>}>
      <ClientDailyPro today={today} />
    </Suspense>
  );
}
