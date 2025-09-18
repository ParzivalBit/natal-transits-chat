// src/app/api/calendar/ics/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';

function pad(n: number, w = 2) {
  return String(n).padStart(w, '0');
}

function toICSStamp(d: Date) {
  // YYYYMMDDTHHMMSSZ (UTC)
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title') ?? 'Transit';
  const description = searchParams.get('description') ?? '';
  const startISO = searchParams.get('start'); // ISO es: 2025-09-18T09:00:00Z
  const durationMin = Number(searchParams.get('duration') ?? '60');

  if (!startISO) {
    return new Response('Missing start', { status: 400 });
  }

  const start = new Date(startISO);
  if (isNaN(start.getTime())) {
    return new Response('Invalid start', { status: 400 });
  }
  const end = new Date(start.getTime() + durationMin * 60_000);

  const now = new Date();
  const ics =
`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//NatalTransitsAI//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${start.getTime()}-nataltransitsai@local
DTSTAMP:${toICSStamp(now)}
DTSTART:${toICSStamp(start)}
DTEND:${toICSStamp(end)}
SUMMARY:${title.replace(/\r?\n/g, ' ')}
DESCRIPTION:${description.replace(/\r?\n/g, ' ')}
END:VEVENT
END:VCALENDAR
`;

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="transit-${toICSStamp(start)}.ics"`,
    },
  });
}
