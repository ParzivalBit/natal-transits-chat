// scripts/backfill-people-house-cusps.ts
/* Backfill delle cuspidi case per tutte le persone con birth data/coord disponibili.
   Calcola sia Placidus che Whole e fa upsert in people_house_cusps.

   Requisiti:
   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in env
   - Accesso alla funzione computePersonHousesForUserSystem del progetto
*/

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { computePersonHousesForUserSystem } from '@/lib/houses/runtime';

type HouseSystem = 'placidus' | 'whole';

type PersonRow = {
  id: string;
  label: string | null;
  birth_date: string | null;               // 'YYYY-MM-DD'
  birth_time: string | null;               // 'HH:MM' | null
  birth_tz_offset_minutes: number | null;  // es. 60
  birth_lat: number | null;
  birth_lon: number | null;
};

function norm360(d: number): number {
  const x = Number(d);
  if (!Number.isFinite(x)) return 0;
  return ((x % 360) + 360) % 360;
}

async function main() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log('→ Fetching people with usable birth data…');
  const { data: people, error } = await supabase
    .from('people')
    .select('id,label,birth_date,birth_time,birth_tz_offset_minutes,birth_lat,birth_lon')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Supabase error while listing people:', error.message);
    process.exit(1);
  }

  const valid: PersonRow[] =
    (people ?? []).filter(
      (p) => p.birth_date && p.birth_lat != null && p.birth_lon != null
    ) as PersonRow[];

  console.log(`✓ Found ${people?.length ?? 0} people, ${valid.length} with usable data.`);

  const SYSTEMS: HouseSystem[] = ['placidus', 'whole'];

  let totalUpserts = 0;
  const BATCH = 25; // upsert in batch per ridurre roundtrips

  for (const system of SYSTEMS) {
    console.log(`\n=== Computing ${system.toUpperCase()} cusps ===`);
    const rowsToUpsert: Array<{
      person_id: string;
      system: HouseSystem;
      cusp: number;
      longitude: number;
    }> = [];

    for (const p of valid) {
      try {
        const res = await computePersonHousesForUserSystem({
          person: {
            birth_date: p.birth_date!,
            birth_time: p.birth_time ?? null,
            tz_offset_minutes: p.birth_tz_offset_minutes ?? 0,
            lat: Number(p.birth_lat),
            lon: Number(p.birth_lon),
          },
          userHouseSystem: system,
        });

        const cusps = (res.cusps ?? []).slice(0, 12);
        if (cusps.length !== 12) {
          console.warn(`• Skipping ${p.id} (${p.label ?? 'no-label'}) — got ${cusps.length} cusps`);
          continue;
        }
        for (let i = 0; i < 12; i++) {
          rowsToUpsert.push({
            person_id: p.id,
            system,
            cusp: i + 1,
            longitude: norm360(cusps[i]!),
          });
        }
      } catch (e) {
        console.warn(`• Error computing ${system} for ${p.id}:`, (e as Error)?.message);
      }

      // upsert a blocchi
      if (rowsToUpsert.length >= BATCH * 12) {
        const { error: upErr } = await supabase
          .from('people_house_cusps')
          .upsert(rowsToUpsert, { onConflict: 'person_id,system,cusp' });
        if (upErr) {
          console.error('❌ Upsert error:', upErr.message);
          process.exit(1);
        }
        totalUpserts += rowsToUpsert.length;
        rowsToUpsert.length = 0;
        process.stdout.write('·');
      }
    }

    // flush finale
    if (rowsToUpsert.length) {
      const { error: upErr } = await supabase
        .from('people_house_cusps')
        .upsert(rowsToUpsert, { onConflict: 'person_id,system,cusp' });
      if (upErr) {
        console.error('❌ Upsert error:', upErr.message);
        process.exit(1);
      }
      totalUpserts += rowsToUpsert.length;
    }

    console.log(`\n✓ ${system}: upserted ${totalUpserts} rows so far.`);
  }

  console.log(`\n🎉 Done. Total upserts: ${totalUpserts}.`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
