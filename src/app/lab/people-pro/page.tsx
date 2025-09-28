// FILE: src/app/lab/people-pro/page.tsx
import { Suspense } from "react";
import PeoplePanel from "@/components/PeoplePanel";
import PeopleList from "@/components/PeopleList";

export const revalidate = 60;

/**
 * Pagina "people-pro" (elenco + form).
 * - Colonna sinistra: form creazione/modifica persona (PeoplePanel)
 * - Colonna destra: lista persone (PeopleList)
 * Alla submit -> redirect automatico a /lab/people/[id]
 * Al click su card -> navigazione a /lab/people/[id]
 */
export default async function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Caricamento…</div>}>
      <div className="mx-auto max-w-6xl px-4 py-8 grid gap-6 md:grid-cols-[1.2fr,1fr]">
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h1 className="mb-3 text-xl font-semibold">Aggiungi/Modifica Persona</h1>
          <PeoplePanel />
        </section>

        <aside className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Persone salvate</h2>
          <PeopleList />
        </aside>
      </div>
    </Suspense>
  );
}
