Natal Transit AI — Guida alla Codebase (per ChatGPT)

Documento di orientamento “file-by-file” per comprendere rapidamente cosa fa ogni parte del progetto, come fluiscono i dati fra UI → API → DB, e dove vengono calcolate/lette/scritte le informazioni astrologiche. Le pagine /lab sono sandbox per iterare le versioni Pro delle ruote senza toccare i componenti stabili di produzione.

0) Mappa del repository e convenzioni

La lista dei file e cartelle principali (con dimensioni) è in _INDEX.md. Qui troverai i path citati sotto e potrai verificare la presenza dei file nel dump KB.

Convenzioni chiave

App Router (Next.js): tutto sotto src/app/** (server components, route handlers /api/**, pagine).

Componenti UI: src/components/** (client/server, ruote, pannelli).

Motore astrologico & utilità: src/lib/** (calcolo case, pianeti del giorno, transiti, sinastria, geocoding/TZ, wrapper Supabase/OpenAI, grafica Pro).

Sandbox Pro: src/app/lab/** (pagine dimostrative/di test per ChartWheelPro, TransitsWheelPro, SynastryWheelPro, DailySkyWheelPro, ecc.).

1) Modello Dati (Supabase) — Tabelle principali

Il dump JSON dello schema (colonne, tipi, PK/FK/commenti) è in db-schema.json. Le tabelle usate nel flusso attuale includono: birth_data, user_prefs, chart_points, house_cusps, natal_aspects, interpretations, transit_events, people, people_chart_points, people_house_cusps, chat_sessions, chat_messages. (Vedi anche “Schema completo DB” nella KB).

birth_data: dati di nascita dell’utente (data, ora, lat, lon, offset TZ). Base per calcolo case/punti.

user_prefs: preferenze utente (house_system = placidus|whole, posizione/tz correnti).

chart_points: punti natali (Sun, Moon, …) con longitude, sign, house, retro.

house_cusps: 12 cuspidi (C1..C12) per sistema case; C1=ASC, C10=MC.

natal_aspects: aspetti tra punti natali (orb, score). (citati nella KB/overview).

interpretations: corpus testuale per titoli/riassunti/consigli usati dal composer AI.

transit_events: transiti “giorno ↔ natal” salvati dalla sandbox daily-pro; scrittura batch per data.

people / people_chart_points / people_house_cusps: profili “persona” per sinastria e relative ruote.

chat_sessions / chat_messages: cronologia chat con contesto astrologico. (citati nel flusso /api/chat).

2) Flussi end-to-end (riassunto operativo)

Onboarding → Salvataggio dati
Auth (Supabase) → raccolta birth_data (+ geocoding/TZ via lib/geo.ts). L’utente può poi lanciare il calcolo case/punti.

Compute case (Placidus/Whole)
/api/chart/compute?system=placidus|whole calcola cuspidi da birth_data, scrive house_cusps e aggiorna chart_points.house. Aggiorna anche user_prefs.house_system.

Dashboard /daily
Calcola pianeti del cielo runtime e transiti del giorno; costruisce contesto per la chat; renderizza ruota + ChatUI.

Chat
/api/chat compone un unico system prompt unendo natal (chart_points), house system + cuspidi (house_cusps/user_prefs), transiti (runtime/DB), poi chiama OpenAI e salva in chat_messages.

Sinastria
/app/lab/people-pro/[id] carica case/punti per utente e persona, calcola aspetti e mostra SynastryWheelPro.

Le pagine /lab servono per iterare grafiche/UX “Pro” senza intaccare i componenti stabili (produzione).

3) src/app/** — Pagine & API Routes
Layout e shell

src/app/layout.tsx — Shell globale (metadati, CSS).

src/app/globals.css — Tailwind base + reset.

Pagine principali (Dashboard)

/dashboard/page.tsx — Hub con card di navigazione (Natal, Transits, Daily, Moon) con check auth SSR.

/dashboard/natal/page.tsx — Carica chart_points dell’utente; monta ChartWheel (ruota classica) + ChatUI. Lettura DB: chart_points.

/dashboard/transits/page.tsx — Mostra “Top transits di oggi” + Chat con contesto della stessa data (UTC).

/dashboard/transits/month/page.tsx — Recupera /api/transits/month e costruisce un contesto “MONTH_TRANSITS” per ChatUI.

/dashboard/daily/page.tsx — Calcolo runtime di pianeti del giorno e case (in base a user_prefs); ruota + ChatUI. Letture: user_prefs (house/tz/pos), eventuali cuspidi/points.

Pagine /lab (sandbox grafica)

/lab/daily-pro/page.tsx & ClientDailyPro.tsx — Calcola pianeti “oggi” via lib/planets/runtime, permette di cambiare orbi/aspetti e inserisce su richiesta gli eventi in transit_events (server action). Usa DailySkyWheelPro. Scritture DB: transit_events (upsert per data).

/lab/transits-pro/page.tsx (+ ClientTransitsPro.tsx) — Carica chart_points utente, calcola pianeti del giorno, opzionale case natalizie runtime (computeHousesForDateUTC), mostra TransitsWheelPro con controlli (toggle aspetti, orb offset). Letture DB: chart_points, user_prefs, birth_data.

/lab/natal-pro/page.tsx — Carica house_cusps (o le calcola runtime) e chart_points, renderizza ChartWheelPro (versione Pro della ruota natale). Letture DB: user_prefs.house_system, house_cusps, birth_data, chart_points.

/lab/people-pro/page.tsx — Gestione elenco/pannello persone (crea/edita “persona” per sinastria) con PeoplePanel + PeopleList.

/lab/people-pro/[id]/page.tsx — Vista sinastria “Pro”: carica case/punti utente e persona (tabelle house_cusps e people_house_cusps), poi monta SynastryWheelPro. Letture DB: people, people_chart_points, people_house_cusps.

Chat “libera”

/chat/page.tsx — Monta ChatUI senza contesto pre-iniettato.

Auth & Sessione

/auth/callback/route.ts — PKCE/OTP: scambia code→sessione (Supabase), redirect a /onboarding#birth.

/api/auth/signout/route.ts — supabase.auth.signOut(); JSON response.

Utente/Preferenze (API)

/api/user/prefs/route.ts — Upsert su user_prefs (house system, posizione corrente); nessuna lettura massiva.

Calcolo & Persistenza astrologica (API)

/api/chart/compute/route.ts — Fulcro del flusso “calcolo case/assi/punti” post-onboarding:

normalizza data/ora locale + offset TZ → UTC;

calcola case (Placidus/Whole) e determina house per ogni punto;

scrive/aggiorna house_cusps e chart_points.house (ed eventuali aspetti natali).
Parametri: ?system=placidus|whole.

Altre route (es. /api/transits/month, /api/chat, /api/geo/resolve) sono citate/evocate nelle pagine e nella KB; la prima restituisce bucket di eventi per mese; la seconda compone il prompt system con contesti natal/transits; la terza effettua geocoding/TZ (Nominatim + tz-lookup).

4) src/components/** — Componenti UI
Chat & Pannelli

components/ChatUI.tsx — Client component minimale per chat: stato locale, POST a /api/chat, supporto a initialContext. Nessuna I/O diretta su DB (le scritture chat avvengono lato API).

components/TransitsToday.tsx / MonthTransitsList.tsx — Listing transiti del giorno/mese usati nelle pagine Transits; non scrivono su DB (consumano dati restituiti dalle API).

components/PeoplePanel.tsx — Form (server action) per creare/aggiornare people; geocoding con Nominatim; calcolo punti e popolamento people_chart_points; redirect all’entry. Scritture: people, people_chart_points.

components/PeopleList.tsx — Elenco persone salvate per navigazione rapida nella sandbox people-pro.

Ruote “classiche” e “Pro”

components/ChartWheel.tsx — Ruota natale “classica” (SVG) che mostra segni/case/punti; usata in /dashboard/natal e in pannelli transits; non scrive su DB.

components/astro/ChartWheelPro.tsx — Ruota natale Pro: usa design tokens, glyphs e utilità polari per glifi/etichette, gestione collisioni, colori per segno e aspetti, anelli case/zodiaco, linee assi. Props: points, houseCusps, axes, size, responsive. Nessuna I/O su DB.

components/astro/TransitsWheelPro.tsx — Ruota transiti Pro: mostra pianeti del cielo vs. punti natali, disegna aspetti con palette standard; props per abilitare tipi di aspetto e offset degli orbi. Nessuna I/O DB (i dati arrivano dalla pagina /lab/transits-pro).

components/astro/SynastryWheelPro.tsx — Ruota sinastria Pro (utente ↔ persona), con due insiemi di punti/case e aspetto-gramma circolare. Dati caricati dalla pagina /lab/people-pro/[id].

components/astro/DailySkyWheelPro.tsx — Ruota del cielo del giorno (solo transiting) con aspetti interni; usata da /lab/daily-pro. Nessuna I/O DB diretta.

components/astro/_parts.tsx — Libreria di parti riutilizzabili (ZodiacRingPro, HousesRingPro, PlanetGlyphsPro, AspectLinesStraightToday, AspectGuides) con palette CSS e utilità polari; nessuna I/O DB.

5) src/lib/** — Motore astrologico, AI, grafica, utilità
Calcoli astrologici

lib/astro.ts — Entry-point del calcolo astrologico (punti, assi, case); esporta tipi come PointName e AspectType, e funzioni usate da API e pagine (computePoints, computeHouses, ecc.). (Descritta nella KB e richiamata da API/pagine).

lib/houses/common.ts — Utility matematiche e tipi per sistemi di case (deg↔rad, normalize, clamp, check latitudini estreme con errore specifico).

lib/houses/placidus.ts — Implementazione Placidus robusta (MIT): calcolo ASC/MC via LST, cuspidi 12/11/9/8 su arco corto, opposte per +180°, fallback Whole Sign sopra |lat|>66.5°. Restituisce cusps, asc, mc.

lib/houses/runtime.ts — Helper per calcolo case a runtime per una data/posizione (usata nelle sandbox transits/natal pro). (citata nelle pagine).

lib/planets/runtime.ts — Calcola i pianeti del giorno a partire da Date (esporta computeDailyPlanets(nowUTC)), usata in /dashboard/daily e /lab/*.

lib/transits.ts — Dati di “transiting longitudes” e calcolo eventi del giorno (computeTransitEventsForDay con orb e score); usata da composer e viste transits.

lib/synastry.ts — Calcolo aspetti tra due profili (orbi per classi di punti, pesi per aspetti/punti), ritorna top-aspetti con score/orb + formatSynastryContext(...) per prompt chat.

Contenuti AI e composizione testi

ai/systemPrompts.ts — System prompt per risposte chart-aware (natal/transits), refiner editoriale, few-shot per strutture Title/Meaning/Focus/Actions/Note.

lib/openai.ts — Wrapper chatComplete(messages, useRefiner) con scelta modello via env; gestisce errori REST.

lib/composer.ts — Cuore del testo AI:

Natal: legge chart_points + interpretations dal DB, costruisce bullets e micro-azioni, opzionale refine/translate.

Transits: calcola top-eventi del giorno → bullets → micro-azioni, e può rifinire con few-shot.

Usa i prompt di ai/systemPrompts.ts. Letture DB: chart_points, interpretations.

Geo & tempo

lib/geo.ts — Geocoding via Nominatim con caching e rate-limit; tz-lookup per timezone; calcolo tzOffsetMinutes via Luxon. Usato in onboarding/people.

lib/time.ts — Helper (todayISOInTZ, nowInfo) per date/ore e offset; usato per costruire contesti e query giorno/mese. (citato in overview).

Supabase (client)

lib/supabaseServer.ts / supabaseBrowser.ts / supabaseAdmin.ts / supabase.ts — Wrapper per client SSR/RSC, browser e service-role. Tutte le API/pagine server passano da qui per leggere/scrivere su DB. (citati e usati diffusamente).

Grafica Pro (palette, glifi, polari)

lib/graphics/tokens.ts — Palette colori per Segni/Aspetti + stroke/font (design tokens).

lib/graphics/glyphs.ts — Unicode per pianeti/segni, path fallback, wrapper colori, normalizzazione EN/IT dei segni (esporta planetChar, signChar).

lib/graphics/polar.ts — Matematica polare per SVG (coordinate, archi, collision avoidance resolveCollisions, leader lines).

lib/graphics/types.ts — Tipi ProPoint (nome, long., casa, segno, retro).

6) Come interagiscono i file (esempi pratici)

Esempio A — Calcolo case & assegnazione house
/api/chart/compute/route.ts legge birth_data (data/ora locale + offset → UTC), invoca il calcolo case (Placidus/Whole) — p.es. via lib/houses/placidus.ts — e poi determina la casa di ogni chart_point con le cuspidi calcolate; scrive house_cusps e aggiorna chart_points.house.

Esempio B — Transits del giorno (runtime) + Chat
/dashboard/transits/page.tsx mostra “Top transits di oggi” (pannello TransitsToday) e apre Chat con contesto della stessa data. Le pagine mese (/dashboard/transits/month) creano un contesto MONTH_TRANSITS da /api/transits/month.

Esempio C — Sandbox grafica /lab
/lab/transits-pro/page.tsx carica natal (chart_points), today (computeDailyPlanets(nowUTC)), e opzionalmente le house natalizie runtime via computeHousesForDateUTC. Passa tutto a TransitsWheelPro con controlli (toggle aspetti, orb offset). Nessuna scrittura DB (solo letture); serve a iterare la grafica “Pro”.

Esempio D — Sinastria Pro (utente ↔ persona)
/lab/people-pro/[id] legge da people_* e house_cusps e monta SynastryWheelPro con due insiemi di punti/case.

7) Script di utilità

scripts/export-kb.mjs — Esporta la repo in chunk Markdown (kb/_INDEX.md, kb/0001.md, …) per condividerla con ChatGPT (filtri/esclusioni/size-cap).

scripts/gen-db-md.mjs — Genera docs/db-schema.md interrogando il DB via DATABASE_URL per produrre documentazione tabelle/PK/FK/commenti.

8) Dettagli utili per chi sviluppa / per il Chatbot

Prompt & Composer: la generazione testi (natal/transits) passa da lib/composer.ts che aggrega dati dal DB e usa ai/systemPrompts.ts + lib/openai.ts. Per bypass o refiner usa env (AI_BYPASS, OPENAI_MODEL_*).

Geocoding/TZ: lib/geo.ts implementa caching e rate-limit verso Nominatim, tzNameFromLatLon e calcolo offset minuti (tzOffsetMinutes) via Luxon.

Placidus robusto: gestione latitudini estreme con fallback Whole; utilità matematiche e normalizzazioni in lib/houses/common.ts; calcolo ASC/MC e cuspidi in lib/houses/placidus.ts.

Grafica Pro: tokens (palette), glyphs (Unicode fallback), polar (archi/coordinate/collision-avoidance) usati da ChartWheelPro, TransitsWheelPro, SynastryWheelPro, DailySkyWheelPro.

/lab come policy: tutte le pagine/prove “Pro” vivono qui per non toccare i componenti in produzione finché non sono maturi.

9) Glossario rapido (progetto)

Chart Point: riga in chart_points o people_chart_points (Sun/Moon/… con longitude, sign, house, retro).

House Cusps: C1..C12 in house_cusps/people_house_cusps (C1=ASC, C10=MC).

Natal Aspects / Transit Events: aspetti fra punti natali o fra pianeta di transito ↔ punto natale (orb & score).

10) Cosa controllare quando qualcosa “non torna”

Se case o assi sembrano errati, verifica: user_prefs.house_system, contenuto birth_data (TZ/offset), e che /api/chart/compute sia stato lanciato col sistema corretto.

Se /daily mostra punti “sballati”, controlla user_prefs (lat/lon correnti) e runtime computeDailyPlanets.

Se la chat non usa il contesto giusto, guarda lib/composer.ts e i dati in chart_points, house_cusps, transit_events/runtime.

Appendice — Nota sulle pagine /lab

Le pagine /lab sono ambiente di test per i componenti grafici “Pro” (Daily/Natal/Transits/Synastry). Servono a iterare su stile, palette, glifi, collision avoidance, e interazione (hover sugli aspetti), senza intaccare i componenti storici funzionanti. Quando stabili, le versioni Pro si possono promuovere nelle pagine dashboard.