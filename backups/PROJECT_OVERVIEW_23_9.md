Natal Transit AI — Mappa dei file & flussi

Questo documento descrive a cosa serve ogni file, dove viene usato, come interagisce col DB Supabase e quali altri moduli richiama, basandosi sulla codebase allegata e sullo schema del database. I riferimenti tra [quadre] indicano i file/estratti da cui è tratto ogni dettaglio.

1) Architettura ad alto livello

Frontend (Next.js App Router + React)

Pagine protette (Dashboard): Natal Chart, Transits, Daily Sky, Moon, Sinastry. Ogni pagina include ChatUI con contesto astrologico dell’utente.

Componenti grafici principali: ChartWheel (tema natale da DB), SkyWheel (cielo del giorno calcolato runtime), ChatUI (UI chat verso /api/chat).

Backend (API Routes)

Calcolo & scrittura: /api/chart/compute (case & assegnazione case), /api/people (crea persona + salva punti/aspetti).

Lettura/servizi: /api/transits/* (transiti), /api/calendar/ics (export eventi), /api/chat (costruisce contesto + memorizza chat).

Librerie interne (/lib)

astro.ts (motore astronomico: posizioni, ASC/MC, case Whole/Placidus, aspetti), transits.ts (transiti & ranking), houses/ (Placidus & Whole, runtime), synastry.ts (aspetti di sinastria), composer.ts (testi AI), openai.ts, time.ts, supabase* (client SSR/Browser/Admin).

Database (Supabase)

Tabelle chiave: birth_data, chart_points, natal_aspects, house_cusps, user_prefs, chat_sessions, chat_messages, people, people_chart_points, people_natal_aspects, transit_events, user_birth_data.

2) Frontend — Pagine e Componenti
2.1 Pagine Dashboard

src/app/dashboard/natal/page.tsx

Legge house system preferito da user_prefs. Carica 12 cuspidi da house_cusps per il sistema scelto; se mancano, ricalcola runtime da birth_data usando computeHouses. Carica i chart points da chart_points. Mostra ChartWheel e HouseSystemSwitcher; include ChatUI.

src/app/dashboard/compat/page.tsx

Flusso analogo: seleziona cuspidi (house_cusps), fa fallback runtime da birth_data, precarica natal points da chart_points per pannello sinastria; UI con HouseSystemSwitcher e PeoplePanel.

src/app/dashboard/people/[id]/page.tsx (lettura persona specifica)

Chiama /api/people/[id] per dettagli persona + punti salvati in people_chart_points.

2.2 Componenti grafici

ChartWheel

Render del tema natale: riceve points (da chart_points) e opzionalmente houseCusps (da house_cusps). È montato dinamicamente in pagine natal/compat ed usa librerie React/SVG per il disegno. (Props e caricamento mostrati in natal/page.tsx.)

SkyWheel

Cielo del giorno: disegna posizioni runtime (non persistite) — es. per /daily. Le posizioni sono calcolate con funzioni runtime (computePlanetsAtUTC/computeDailyPlanets) in lib/planets/runtime.ts.

ChatUI

Interfaccia chat collegata a /api/chat (invio messaggi, ricezione risposta). È caricata dinamicamente nelle pagine; /api/chat costruisce contesto (natal points, transiti, cuspidi) e salva i messaggi su chat_messages.

HouseSystemSwitcher

Permette di switchare Whole/Placidus: invoca /api/chart/compute?system=… per ricalcolare e persistire cuspidi + aggiornare chart_points.house.

3) Backend — API Routes
3.1 Tema natale & case

src/app/api/chart/compute/route.ts

Autenticazione via Supabase SSR client.

Legge/aggiorna preferenza house system in user_prefs (override da querystring).

Legge birth_data (date/time/tz/lat/lon). Se manca time, blocca il calcolo case.

Calcola JD (UT) da data/ora locale + tz_offset_minutes.

Chiama computeHouses(system, { jd, latDeg, lonDeg }), che instrada a Placidus o Whole.

Persistenza:

Sostituisce 12 righe in house_cusps per il sistema scelto.

Aggiorna chart_points.house per ogni punto natale usando assignHouses (Placidus‐safe).

Ritorna {systemUsed, asc, mc, fallbackApplied} (flag di fallback per latitudini estreme).

src/app/api/people/route.ts & [id]/route.ts

GET: lista persone (people) o singola persona + people_chart_points.

POST: crea persona in people, calcola punti/aspetti via lib/astro, e inserisce in people_chart_points e people_natal_aspects.

3.2 Chat & interpretazioni

src/app/api/chat/route.ts

Costruisce system/context: preferenze house (da house_cusps + user_prefs), natal context (da chart_points), transits del giorno, UI context; invia al modello OpenAI; salva cronologia in chat_messages (legata a chat_sessions).

src/app/api/interpret/transits/route.ts

Esegue pipeline interpretativa in due step: composeTransitsSkeleton (recupero dati/struttura) + refineTransitText (rifinitura AI, focus/lang). Non scrive su DB; ritorna testo + scheletro.

3.3 Transiti, calendario, ping

src/app/api/transits/month/route.ts

Endpoint per transiti del mese basato su astronomy-engine. (Tipi Point/Transit nel file.)

src/app/api/calendar/ics/route.ts

Genera file .ics on-the-fly per un transito (nessuna persistenza).

src/app/api/ping/route.ts

Healthcheck JSON ({ok:true,msg:'pong'}).

4) Librerie interne
4.1 Motore astrologico & case

src/lib/astro.ts

Calcola posizioni (geocentriche, eclittiche of-date) per Sole-Luna-pianeti usando astronomy-engine; rileva retrogradazioni; deduce segno/casa (Whole) e genera ASC/MC.

Casa system factory: computeHouses(system, { jd, latDeg, lonDeg }) → Placidus: computePlacidusCusps; Whole: computeWholeCuspsFromAsc(ASC, MC). Ritorna anche fallbackApplied.

assignHousesGeneric(longitude, cusps) delega al wrap-safe di Placidus (assignHouses) per gestire correttamente archi non uniformi.

src/lib/houses/placidus.ts (citato)

Espone computePlacidusCusps (12 cuspidi + ASC/MC da JD/lat/lon) e assignHouses (determinazione robusta della casa su archi Placidus irregolari). Usato da astro.ts e dalle API (/api/chart/compute). (Richiamato nei file di cui sopra.)

src/lib/houses/whole.ts

computeWholeCuspsFromAsc(ascDeg, mcDeg): cuspide I = inizio segno dell’ASC, poi ogni 30°. Ritorna {system:'whole', cusps, asc, mc}.

src/lib/houses/runtime.ts

Utilità runtime: da dateUTC → JD; chiama computeHouses; marca fallbackApplied per latitudini estreme. Non persiste su DB.

4.2 Transiti, sinastria, composer

src/lib/transits.ts

Calcolo longitudini transiting per pianeti esterni+personali; event matching su aspetti (con orb e score), ranking e helpers (noon UT, ecc.). Ritorna strutture TransitLongitude/TransitEventCalc.

src/lib/synastry.ts

Confronta due liste di punti natali; definisce orb per classi di punti (lum/pers/soc/out/ang), pesi per aspetto/punto; produce top-aspetti con score ordinato. Offre formatSynastryContext per il prompt del chatbot.

src/lib/composer.ts

Pipeline interpretativa AI:

Legge natal points (chart_points) e interpretations dal DB.

Calcola transits del giorno (computeTransitingLongitudes, computeTransitEventsForDay) e compone uno scheletro.

Se AI_BYPASS off e OPENAI_API_KEY presente, chiama chatComplete (modello configurabile).

4.3 Tempo, OpenAI, Supabase

src/lib/time.ts — timezone di default, todayISOInTZ, nowInfo (ISO, human, offset).

src/lib/openai.ts — wrapper chatComplete(messages, useRefiner?) con scelta modello da env (OPENAI_MODEL_*).

Supabase clients

supabaseServer.ts: SSR client con cookies (RSC: read-only; Route: mutate cookie). Legge NEXT_PUBLIC_SUPABASE_URL/ANON o fallback.

supabaseBrowser.ts: client browser con sessione persistente.

supabaseAdmin.ts: service role per job server-side (no refresh/persist).

supabase.ts: client base da env pubbliche.

4.4 Pianeti runtime (Daily)

src/lib/planets/runtime.ts

Con astronomy-engine calcola longitudini e retro per i pianeti in due istanti (oggi e ieri) e deduce il moto; mapping dei nomi, normalizzazione e segno. Usato per SkyWheel / daily.

5) Database — Schema e relazioni

Estratto da db-schema.json. Tipi e chiavi esterne sono riassunte per la comprensione del flusso.

birth_data — input di nascita utente: date, time?, tz_offset_minutes?, place_name?, lat?, lon?. FK su auth.users. Fonte primaria per JD/lat/lon nei calcoli case.

chart_points — posizioni natali (per user): kind, name, longitude, sign, house?, retro?. Aggiornamento house dopo calcolo cuspidi.

natal_aspects — aspetti tra punti natali (p1,p2,aspect,orb,strength/score).

house_cusps — 12 righe per utente e system (whole|placidus): cusp 1..12, longitude. Ricalcolate da /api/chart/compute.

user_prefs — preferenze (location corrente, TZ corrente, house_system default 'whole'). PK user_id.

chat_sessions & chat_messages — cronologia chat; chat_messages.session_id → FK su chat_sessions.id.

people — anagrafiche per sinastria (label, birth_date/time, tz, place, lat/lon). FK su auth.users.

people_chart_points / people_natal_aspects — analoghi a chart_points/natal_aspects ma per la tabella people.

transit_events — (struttura per archiviare calcoli di transito: date, t_planet, n_point, aspect, orb, score).

user_birth_data — versione normalizzata con birth_datetime_utc, latitude/longitude (supporto/ottimizzazioni).

6) Flussi principali end-to-end

Onboarding → Calcolo tema natale

L’utente salva birth_data.

/api/chart/compute legge preferenza house system (user_prefs), calcola cuspidi con computeHouses, persistendo 12 righe in house_cusps e aggiorna chart_points.house.

Pagina Natal

Legge user_prefs.house_system, carica 12 house_cusps; se mancanti, fallback runtime da birth_data con computeHouses. Carica chart_points. Renderizza ChartWheel.

Chat su ogni pagina

/api/chat compone contesto: cuspidi attive (e sistema), natal points, transiti correnti, e UI context. Chiama OpenAI e salva i messaggi su chat_messages.

People/Sinastria

/api/people crea persona, calcola punti/aspetti (lib/astro) e inserisce in people_chart_points/people_natal_aspects; GET /api/people/[id] ritorna persona + punti.

Transiti & ICS

/api/transits/month produce dataset dei transiti (no persistenza).

/api/calendar/ics esporta un evento iCalendar per il giorno del transito.

7) Note di implementazione su Placidus (già in codice)

Factory case: computeHouses('placidus'|'whole', …) dirige verso Placidus (cuspidi irregolari + assignHouses robusto) o Whole (equispaziate). ASC/MC inclusi nel risultato; fallback automatico per latitudini estreme.

Persistenza: /api/chart/compute elimina+inserisce house_cusps (12 righe) per il sistema scelto e rideriva chart_points.house via assignHouses.

Preferenze: user_prefs.house_system (default 'whole') aggiornabile via query param dell’endpoint compute. Le pagine leggono sempre dallo stato preferito e fanno fallback runtime se mancano righe in house_cusps.

8) Altri file di progetto

package.json — script utili: export:kb per rigenerare la KB markdown, docs:schema per doc DB. Dipendenze: astronomy-engine, @supabase/*, luxon, openai, ecc.

scripts/export-kb.mjs — traversa la repo ed esporta in chunk .md (150 KB cad.).

eslint.config.mjs, postcss.config.cjs, tailwind — setup lint/stili.

api/ping — healthcheck.

9) Glossario rapido (entità di dominio)

Chart Point: una riga in chart_points (o people_chart_points), es. Sun, Moon, … con longitude, sign, house, retro.

House Cusps: 12 longitudini (cuspidi I..XII) per system = 'whole'|'placidus' salvate in house_cusps. Cusp I = ASC, Cusp X = MC.

Natal Aspects: aspetti tra coppie di punti natali con orb e strength/score.

Transit Events: match tra transiting planet e natal point con aspect, orb, score.

10) Come leggere/seguire il codice

Parti dal flusso /api/chart/compute per capire come house system guida i calcoli e la persistenza; poi apri lib/astro.ts per la factory di case e la logica ASC/MC; completa con lib/houses/*.

Guarda dashboard/natal per capire come le pagine riusano i dati persistiti e come fanno fallback runtime; poi ChatUI + /api/chat per il contesto unificato al chatbot.

Per sinastria, passa da /api/people (POST) → lib/astro (calcolo) → tabelle people_* → UI compat.