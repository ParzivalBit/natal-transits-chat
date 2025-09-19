-- 0002_people_synastry.sql
-- Tabelle per persone (contatti) e relativi dati astrologici


create table if not exists public.people (
id uuid primary key default gen_random_uuid(),
user_id uuid not null references public.users(id) on delete cascade,
label text not null, -- es. "papà", "collega 1"
birth_date date not null,
birth_time text, -- HH:MM opzionale
birth_tz_name text, -- es. Europe/Rome
birth_tz_offset_minutes int, -- comodo per storicizzare
birth_place_name text,
birth_lat double precision,
birth_lon double precision,
current_place_name text, -- opzionale: dove si trova ora
current_lat double precision,
current_lon double precision,
current_tz_name text,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
);


create table if not exists public.people_chart_points (
id bigserial primary key,
person_id uuid not null references public.people(id) on delete cascade,
name text not null, -- Sun, Moon, Mercury, ... ASC, MC
longitude double precision not null,
sign text not null,
house int,
retro boolean default false
);


create table if not exists public.people_natal_aspects (
id bigserial primary key,
person_id uuid not null references public.people(id) on delete cascade,
p1 text not null,
p2 text not null,
aspect text not null, -- conjunction|sextile|square|trine|opposition
orb double precision not null,
strength int not null
);


-- RLS
alter table public.people enable row level security;
alter table public.people_chart_points enable row level security;
alter table public.people_natal_aspects enable row level security;


create policy people_rw_own on public.people
for all using (user_id = auth.uid()) with check (user_id = auth.uid());


create policy ppl_points_rw_own on public.people_chart_points
for all using (person_id in (select id from public.people where user_id = auth.uid()))
with check (person_id in (select id from public.people where user_id = auth.uid()));


create policy ppl_aspects_rw_own on public.people_natal_aspects
for all using (person_id in (select id from public.people where user_id = auth.uid()))
with check (person_id in (select id from public.people where user_id = auth.uid()));