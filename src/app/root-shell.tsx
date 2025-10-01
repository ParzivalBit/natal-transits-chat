'use client';

import { usePathname } from 'next/navigation';
import React from 'react';

export default function LabOrDefaultShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLab = pathname?.startsWith('/lab') ?? false;

  if (isLab) {
    // ── Frame per le pagine /lab ───────────────────────────────────────────────
    return (
      <div className="min-h-[100dvh] w-full flex flex-col overflow-auto">
        {/* header identico ma full-bleed */}
        <header className="border-b shrink-0">
          <div className="mx-auto w-full max-w-none px-4 py-4 flex items-center justify-between">
            <div className="font-semibold">Natal + Transits + Chat</div>
            <nav className="text-sm text-gray-600">MVP</nav>
          </div>
        </header>

        {/* main: nessun max-w globale ⟶ la pagina decide gli spazi.
            h-full + overflow-hidden ⟶ niente scrollbar della finestra */}
        <main className="flex-1 w-full">
          {children}
        </main>

        {/* niente footer su /lab per evitare overflow verticale */}
      </div>
    );
  }

  // ── Frame predefinito (tutto il resto del sito) ─────────────────────────────
  return (
    <>
      <header className="border-b">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <div className="font-semibold">Natal + Transits + Chat</div>
          <nav className="text-sm text-gray-600">MVP</nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10">
        {children}
      </main>

      <footer className="border-t text-xs text-gray-500">
        <div className="mx-auto max-w-7xl px-4 py-6 space-y-2">
          <p>
            Disclaimer: this app provides content for wellness &amp; entertainment purposes only.
            It does not replace professional medical, legal, or financial advice.
          </p>
          <p>
            Transparency: MVP uses Whole Sign houses when birth time is available; otherwise a solar chart
            (no houses/ASC) with simplified orbs.
          </p>
        </div>
      </footer>
    </>
  );
}
