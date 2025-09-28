// FILE: src/components/PeopleList.tsx
import Link from "next/link";
import { createSupabaseServerComponentClient } from "@/lib/supabaseServer";

/**
 * Elenco persone salvate dall'utente corrente.
 * Allineato allo schema reale della tabella "people":
 *  - label (nome/alias), created_at, (niente display_name).
 * Fonte: db-schema.json (tabella people). :contentReference[oaicite:1]{index=1}
 */
export default async function PeopleList() {
  const supabase = createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
        Accedi per vedere le persone salvate.
      </div>
    );
  }

  const { data, error } = await supabase
    .from("people")
    .select("id, label, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return (
      <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
        Errore nel caricare la lista persone.<br />
        <span className="text-xs opacity-80">Dettagli: {error.message}</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
        Nessuna persona salvata. Usa il form a sinistra per aggiungerne una.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {data.map((p) => (
        <Link
          key={p.id}
          href={`/lab/people-pro/${p.id}`}
          className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition hover:shadow"
        >
          <div className="text-sm font-medium">{p.label || p.id}</div>
          <div className="mt-1 text-xs text-gray-500">ID: {p.id}</div>
        </Link>
      ))}
    </div>
  );
}
