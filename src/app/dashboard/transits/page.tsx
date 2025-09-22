// src/app/dashboard/transits/page.tsx
import ChatUI from '@/components/ChatUI';

export const dynamic = 'force-dynamic';

function todayUTCISO(): string {
  // Restituisce la data UTC in formato YYYY-MM-DD
  const d = new Date();
  const iso = d.toISOString(); // sempre in UTC
  return iso.slice(0, 10);
}

export default async function TransitsPage() {
  const dateUTC = todayUTCISO();

  const ctx = `CONTEXT_TRANSITS_TODAY
Date: ${dateUTC}

Guidelines:
- Focus on work/relationships/energy with realistic tips (2–3).
- Avoid absolutes; wellbeing/entertainment.
`;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="rounded-2xl border p-4 min-h-[480px]">
        <h2 className="text-lg font-semibold mb-3">Transits — Today</h2>
        <p className="text-sm text-muted-foreground mb-2">
          Questa vista mostra i transiti di oggi. Usa la chat a destra per chiedere un’interpretazione contestuale.
        </p>
        {/* Qui puoi eventualmente inserire la lista dei transiti o un calendario */}
        <div className="text-sm text-muted-foreground">
          Data (UTC): <span className="font-mono">{dateUTC}</span>
        </div>
      </div>

      <div className="rounded-2xl border p-4 min-h-[480px]">
        <h2 className="text-lg font-semibold mb-3">Ask about today</h2>
        {/* ChatUI si aspetta initialContext (string), NON "context" (oggetto) */}
        <ChatUI initialContext={ctx} />
      </div>
    </div>
  );
}
