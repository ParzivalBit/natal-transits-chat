- Obiettivo del progetto

    Web app astrologica che calcola:

    Tema natale

    Transiti (oggi / mese)

    Sinastria

    Cielo del giorno

    Calendario lunare

    Ogni sezione è affiancata da un chatbot AI contestualizzato sui dati astrologici dell’utente e del momento.

- Struttura generale
    - Frontend (Next.js App Router + React)

    Layout: layout.tsx, globals.css → struttura base e stili globali.

    Onboarding: raccoglie dati nascita (BirthForm) e location (CurrentLocationForm), salva tutto nel DB via API dedicate.

    Dashboard: pagine protette che mostrano:

    Natal chart (ChartWheel)

    Transits (TransitsToday)

    Daily sky (SkyWheel)

    Moon phase (MoonPhaseCard)
    Ogni pagina include ChatUI con contesto preimpostato.

    - Componenti grafici

    ChartWheel: disegna il tema natale (punti da chart_points nel DB).

    SkyWheel: disegna il cielo del giorno (punti calcolati al volo).

    ChatUI: interfaccia di chat, comunica con /api/chat.

    - Backend (API Routes)
    Calcolo & scrittura dati

    /api/chart/compute: punto centrale → calcola punti natali e aspetti (lib/astro), salva in birth_data, chart_points, natal_aspects.

    /api/user/prefs: salva preferenze utente (location corrente, sistema di case).

    /api/chat: costruisce contesto (chart_points + transiti odierni), chiama OpenAI, salva messaggi in chat_messages.

    - Lettura / servizi

    /api/transits: calcola transiti attuali usando lib/transits.

    /api/geo/resolve + /api/geo/search: geocoding, timezone.

    /api/calendar/ics: esporta eventi .ics per un transito.

    /api/interpret/...: genera testi più lunghi usando lib/composer.

    - Librerie interne (/lib)

    astro.ts → motore astrologico base: calcolo posizioni, case Whole Sign, aspetti.

    transits.ts → calcolo transiti giornalieri, orb e ranking con punteggio.

    composer.ts → compone testi interpretativi usando dati DB + AI.

    geo.ts → geocoding con Nominatim e calcolo TZ.

    time.ts → utilità temporali.

    openai.ts → wrapper API OpenAI.

    supabase* → client SSR/Browser per DB.

- Database (Supabase / Postgres)
    Tabelle principali

    users – anagrafica utente.

    birth_data – input nascita (data, ora, luogo, TZ).

    chart_points – posizioni calcolate (segno, casa, retro, ecc.).

    natal_aspects – aspetti fra punti natali.

    house_cusps – cuspidi case per sistema (whole o placidus).

    user_prefs – preferenze correnti (location, TZ, house system).

    chat_sessions / chat_messages – storico chat.

    interpretations – testi interpretativi (seedata).

    people – dati per sinastrie.

- Flusso dati

    Onboarding → salva in birth_data → /api/chart/compute genera chart_points, natal_aspects, house_cusps.

    Natal page → legge da chart_points.

    Daily page → calcola punti runtime con computePoints + preferenze da user_prefs.

    Transits → calcolo runtime via /api/transits.

    Chat → arricchisce contesto leggendo chart_points (e transiti) e salva messaggi in chat_messages.

- Considerazioni su implementazione Placidus

    Già predisposto: user_prefs.house_system + tabella house_cusps.

    Da fare: estendere lib/astro per calcolare cuspidi Placidus e assegnare case ai punti.

    Persistenza: chart_points.house + house_cusps con system='placidus'.

    UI: un solo componente Wheel, switch Whole/Placidus via pulsante.