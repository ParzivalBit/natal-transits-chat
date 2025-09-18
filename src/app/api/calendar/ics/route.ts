// src/app/api/calendar/ics/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function nextDayISO(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toICSDate(iso: string): string {
  return iso.replace(/-/g, '');
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title') || 'Transit';
  const date = searchParams.get('date'); // YYYY-MM-DD
  const desc = searchParams.get('desc') || 'Astrology transit (wellness/entertainment).';

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: 'Missing or invalid date' }, { status: 400 });
  }

  const dtStart = toICSDate(date);
  const dtEnd = toICSDate(nextDayISO(date));

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NatalTransitsAI//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@natal-transits`,
    `DTSTAMP:${toICSDate(new Date().toISOString().slice(0,10))}T000000Z`,
    `DTSTART;VALUE=DATE:${dtStart}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${title.replace(/\r?\n/g, ' ')}`,
    `DESCRIPTION:${desc.replace(/\r?\n/g, ' ')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="transit-${dtStart}.ics"`,
      'Cache-Control': 'no-store',
    },
  });
}
