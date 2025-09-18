// src/components/MoonPhaseCard.tsx
'use client';

import React from 'react';

export default function MoonPhaseCard({
  dateISO,
  tzName,
  moonSign,
  phaseName,
  illumination, // 0..1
  emoji,        // 🌑🌒🌓🌔🌕🌖🌗🌘
}: {
  dateISO: string;
  tzName: string;
  moonSign: string;
  phaseName: string;
  illumination: number;
  emoji: string;
}) {
  const pct = Math.round(illumination * 100);

  return (
    <div className="rounded-2xl border p-4 bg-white">
      <div className="mb-3 text-sm font-medium">
        Lunar calendar · {dateISO} ({tzName})
      </div>

      <div className="flex items-center gap-4">
        <div className="flex h-24 w-24 items-center justify-center rounded-xl border text-4xl bg-gray-50">
          {emoji}
        </div>

        <div className="text-sm">
          <div className="text-lg font-semibold mb-1">Moon in {moonSign}</div>
          <div className="text-gray-700">{phaseName}</div>
          <div className="text-gray-500">{pct}% illuminated</div>
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        Wellbeing/entertainment. The Moon sign and phase are calculated for the selected date/time.
      </p>
    </div>
  );
}
