// src/lib/transitContext.ts
import {
  computeTransitEventsForDay,
  type TransitEventCalc,
  type TransitLongitude, // deve essere esportato da '@/lib/transits'
} from '@/lib/transits';

export interface ComposeTransitContextArgs {
  user_id: string;
  dateUTC: string; // ISO, es. "2025-09-30"
  natalPoints: {
    id: string;     // "Sun", "ASC", ecc. (gli angoli verranno filtrati)
    name: string;   // nome del punto
    lonDeg: number; // [0..360)
  }[];
}

/** Ricavo il tipo del nome richiesto da TransitLongitude (es. BodyName) senza importarlo esplicitamente */
type TLName = TransitLongitude['name'];

/** Lista chiusa di corpi ammessi per i transiti (esclude ASC/MC). Aggiungi qui eventuali altri (Chiron, TrueNode, ecc.) */
const BODY_NAMES = [
  'Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto',
] as const satisfies readonly TLName[];

/** Type guard: da string a TLName */
function isTLName(x: string): x is TLName {
  return (BODY_NAMES as readonly string[]).includes(x);
}

/** Wrapper che forza l'overload con TransitLongitude[] */
type ComputeWithTL = (userId: string, natal: TransitLongitude[], dateUTC: string) => Promise<TransitEventCalc[]>;
const computeWithTL = computeTransitEventsForDay as unknown as ComputeWithTL;

export async function composeTransitContext(
  { user_id, dateUTC, natalPoints }: ComposeTransitContextArgs
): Promise<{ events: TransitEventCalc[]; note: string }> {

  // Costruisco TransitLongitude[] perfettamente tipato (name: TLName)
  const natalTL: TransitLongitude[] = natalPoints
    .filter(p => isTLName(p.name))          // filtra fuori ASC/MC e punti non planetari
    .map(p => ({
      name: p.name as TLName,               // ora è compatibile
      longitude: p.lonDeg,
    }));

  // Chiamo la funzione core usando esplicitamente l’overload tipizzato con TL[]
  const events = await computeWithTL(user_id, natalTL, dateUTC);

  return {
    events,
    note: `Context computed at runtime for ${dateUTC} (no DB persistence).`,
  };
}