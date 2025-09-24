Natal Transit AI — Guida alla Codebase (per ChatGPT)

Questo documento mappa cosa fa ogni file, dove viene usato, come interagisce con il DB e quali dipendenze richiama. È pensato per essere allegato alla KB del progetto così che ChatGPT possa orientarsi rapidamente.

1) Stack & dipendenze

Next.js 14 (App Router), React 18, TypeScript, Tailwind — frontend.

Supabase (auth/DB/storage), OpenAI (chat), astronomy-engine (epemeridi), Luxon (tempi), SWR (dati). Vedi package.json per versioni e script (dev, build, export:kb, docs:schema).

2) Schema Database (Supabase)

Tabelle chiave (estratto):

birth_data: input nascita (data/ora/luogo/TZ) per utente. FK su auth.users. Fonte per JD/lat/lon.

chart_points: posizioni natali calcolate (name/kind/longitude/sign/house/retro). Aggiornate anche dopo il ricalcolo case.

natal_aspects: aspetti tra punti natali (orb/strength).

house_cusps: 12 cuspidi per system = whole|placidus; C1=ASC, C10=MC.

user_prefs: preferenze (location/TZ correnti + house_system, default whole).

chat_sessions / chat_messages: storico chat.

people, people_chart_points, people_natal_aspects: analoghi per sinastria.

transit_events: (struttura di archiviazione transiti giornalieri, opzionale).

Nota operativa: le pagine leggono sempre il sistema case preferito da user_prefs.house_system (override via query dell’endpoint compute). Se le cuspidi mancano, fanno fallback al calcolo runtime.

3) API Routes (backend Next.js)
Auth

src/app/api/auth/set-session/route.ts
Scrive i cookie di sessione server-side a partire da access_token/refresh_token ricevuti dal client Supabase. Usa createSupabaseServerRouteClient. Restituisce JSON.

src/app/api/auth/signout/route.ts
Esegue supabase.auth.signOut() e redirige/risponde JSON a seconda del contesto (presente in due varianti equivalenti nella KB).

src/app/auth/callback/route.ts
Gestisce il redirect post-signup (PKCE/OTP): exchangeCodeForSession e redirect a /onboarding#birth.

Calendario

src/app/api/calendar/ics/route.ts
Genera un file .ics (evento all-day) per un transito: GET?title&date&desc. Nessuna persistenza.

Chatbot

src/app/api/chat/route.ts
Costruisce il contesto chat unendo:

NATALE: da chart_points (name/sign/house/retro).

TRANSITI odierni: se non già passati via UI, chiama /api/transits interno e formatta CONTEXT_TRANSITS_TODAY.

CASE: legge user_prefs.house_system e, se esistono, carica 12 cuspidi da house_cusps includendo ASC/MC nel contesto.

Prompt “system” per lo stile di risposta.
Chiama OpenAI (gpt-4o-mini), salva i messaggi eventuali in chat_messages.

Case & Cuspidi (core)

src/app/api/chart/compute/route.ts
Flusso completo:

Determina system (whole|placidus) da user_prefs o override ?system=... (e aggiorna user_prefs).

Legge birth_data dell’utente (richiede time per le case).

Calcola JD/UTC (gestendo tz_offset_minutes).

Calcola le cuspidi con computeHouses(system, { jd, latDeg, lonDeg, tzMinutes }).

Persiste 12 righe in house_cusps (dopo delete by user+system).

Aggiorna chart_points.house con assignHouses(...) (Placidus-aware).

Ritorna { ok, systemUsed, asc, mc, fallbackApplied }.

Compat / Sinastria

src/app/api/compat/[id]/route.ts
End-to-end per compatibilità: utilità di parsing sicuro, funzioni di synastry, possibile integrazione transiti “del giorno”; produce contesto CONTEXT_SYNASTRY.

4) Librerie interne (/lib)
Motore astrologico & case

src/lib/astro.ts
Factory dei calcoli: posizioni geocentriche (astronomy-engine), retrogradazioni, segno; ASC/MC; case via computeHouses(system) con Placidus o Whole; assignHousesGeneric delega a placidus.assignHouses per archi irregolari. (Descrizione consolidata nella KB.)

src/lib/houses/placidus.ts
Espone computePlacidusCusps(...) e assignHouses(...). Usato da astro.ts e da /api/chart/compute.

src/lib/houses/whole.ts
computeWholeCuspsFromAsc(ascDeg, mcDeg) → cusp I all’inizio del segno dell’ASC, poi ogni 30°.

src/lib/houses/runtime.ts
Helper runtime (UTC→JD, fallback flag). Non persiste.

Transiti & Sinastria

src/lib/transits.ts
Calcola longitudini dei pianeti in transito, match con punti natali su aspetti (conjunction|sextile|square|trine|opposition), orb e score, ranking. Tipi TransitLongitude e TransitEventCalc.

src/lib/synastry.ts
Confronta due set di punti natali: orbi per classi di punti, pesi per aspetti/punti, restituisce top-aspetti con score e orb. Fornisce formatSynastryContext(...) per il prompt del chatbot.

Composer (testi AI)

src/lib/composer.ts
Natal: legge chart_points + interpretations (DB); compone bullets + micro-azioni; opzionale refine/translate via OpenAI.
Transits: calcola top eventi→bullets→micro-azioni; refine via few-shot.
Usa systemRefiner, few-shot fewShot_planet/fewShot_transit.

Prompt & utilità

src/ai/systemPrompts.ts
Prompt system per risposte chart-aware, refiner editoriale, few-shot per transiti/natale (struttura Title/Meaning/Focus/Actions/Note + Tech notes opzionali).

src/lib/geo.ts
Nominatim search (caching & rate-limit), tz-lookup per timezone, calcolo offset minuti in Luxon.

src/lib/time.ts
todayISOInTZ, nowInfo (ISO/human/UTC offset).

Supabase clients:
supabaseServer.ts (SSR/RSC), supabaseBrowser.ts (client), supabaseAdmin.ts (service role), supabase.ts (base). Panoramica in KB.

OpenAI wrapper:
src/lib/openai.ts con chatComplete(...) (modello via env).

Grafica “Pro” (ruote migliorate)

src/lib/graphics/tokens.ts — palette/weight (segni, aspetti, stroke/font).

src/lib/graphics/glyphs.ts — simboli Unicode & path fallback, colori wrapper, normalizzazione EN/IT dei segni.

src/lib/graphics/polar.ts — utilità polari pure: polarToXY, describeArc, resolveCollisions, leaderLine.

5) Pagine (App Router)

src/app/layout.tsx
Shell dell’app (header/footer/disclaimer). Nota trasparenza: default Whole Sign o “solar chart” senza case se manca birth time.

src/app/chat/page.tsx
Monta ChatUI (senza contesto pre-iniettato).

src/app/dashboard/daily/page.tsx
Server component protetta (redirect se non loggato).

Legge TZ/posizione correnti da user_prefs.

Calcola sky points runtime con computePoints (da lib/astro).

Costruisce CONTEXT_TRANSITS_TODAY per ChatUI.

Renderizza SkyWheel + ChatUI.

Onboarding/Auth
src/app/onboarding/... (raccolta birth data; non tutto incluso nei chunk) + AuthForm.tsx (signup/signin via Supabase + POST a /api/auth/set-session per cookie SSR; poi redirect a /onboarding#birth).

/lab (ambiente di test componenti Pro)
Esempio: pagina “Lab · Transits Pro” legge chart_points, calcola transiting al volo, mostra ruota TransitsWheelPro — isolato dal flusso “prod” per iterare sulla grafica senza toccare i componenti stabili.

6) Componenti UI

src/components/ChatUI.tsx
Client component minimal per chat: mantiene stato locale, invia /api/chat con eventuale initialContext, mostra scambi. (Contiene placeholder d’aiuto per prompt utente.)

SkyWheel / ChartWheel / Pro
Dai chunk risultano SVG con etichette segno/casa e punti (“Sun/Moon/…”, sign, H{n} quando presente). Le versioni Pro usano le utilità grafiche (tokens, glyphs, polar) per un layout più ricco (colori per segno, collision avoidance, leader lines). Gli snippet evidenziano la resa testuale segno+casa accanto al glifo del punto.

Nota: le pagine /lab servono apposta per far evolvere WheelChartPro/SkyWheelPro/TransitsWheelPro senza intaccare i componenti “storici” già funzionanti.

7) Flussi end-to-end (riassunto)

Onboarding → Salvataggio dati
Auth (Supabase) → raccolta birth_data (+ geocoding/TZ via geo.ts). Alla conferma, l’utente può lanciare il calcolo.

Compute case (Placidus/Whole)
/api/chart/compute?system=placidus|whole: calcola cuspidi da birth_data, scrive house_cusps e aggiorna chart_points.house. Imposta/aggiorna user_prefs.house_system.

Dashboard /daily
Carica sky points runtime + transiti del giorno; produce contesto per Chat. Renderizza SkyWheel + ChatUI.

Chat
/api/chat: unisce natal (chart_points), house system + cuspidi (house_cusps, user_prefs), e transiti (interni o da UI) in un unico prompt “system”, quindi chiama OpenAI. Salva messaggi in chat_messages.

Sinastria
/api/compat/[id]: compone contesto con top aspetti tra due profili (people_*) e opzionalmente transiti; restituisce risposte coerenti col contesto.

8) Script & documentazione

scripts/export-kb.mjs — esporta la repository in chunk Markdown (kb/_INDEX.md, kb/0001.md, …), con esclusioni e size-cap, per condividerla con ChatGPT.

scripts/gen-db-md.mjs — genera docs/db-schema.md con tabelle/PK/FK/commenti usando DATABASE_URL.

9) Come “leggere” il progetto (roadmap per dev/AI)

Parti da /api/chart/compute per capire il pivot “case system → cuspidi → update house” e la persistenza.

Apri lib/astro.ts e lib/houses/* per i dettagli di ASC/MC e dei due sistemi (Placidus/Whole).

Guarda dashboard/daily + lib/transits.ts per il ciclo dei transiti e il contesto chat.

Studia /api/chat + ai/systemPrompts.ts per capire come nascono le risposte del chatbot.

Per la grafica, vedi lib/graphics/* e le pagine /lab per i componenti Pro in sviluppo isolato.

10) Glossario rapido

Chart Point: riga in chart_points (o people_chart_points), es. Sun/Moon… con longitude, sign, house, retro.

House Cusps: 12 longitudini C1..C12 in house_cusps per system. C1=ASC, C10=MC.

Natal Aspects / Transit Events: aspetti tra punti natali / tra transiting planet e natal point (con orb e score).

Appendice: pagine e componenti citati ma non integralmente nei chunk

Alcuni file (es. src/lib/astro.ts, src/lib/houses/placidus.ts, SkyWheel/ChartWheel/WheelChartPro) sono ampiamente referenziati da API e pagine qui documentate: la loro funzione è attestata in PROJECT_OVERVIEW e nell’uso da parte di /api/chart/compute, dashboard/daily, /lab e dei moduli grafici Pro.