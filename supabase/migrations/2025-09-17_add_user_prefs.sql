-- 2025-09-17_add_user_prefs.sql
create table if not exists public.user_prefs (
  user_id uuid primary key references public.users(id) on delete cascade,
  current_place_name text,
  current_lat double precision,
  current_lon double precision,
  current_tz_name text,
  focus jsonb default '[]'::jsonb, -- es. ["work","relationships"]
  updated_at timestamptz default now()
);

alter table public.user_prefs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_prefs' and policyname='user_prefs_select_own'
  ) then
    create policy user_prefs_select_own
      on public.user_prefs for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_prefs' and policyname='user_prefs_upsert_own'
  ) then
    create policy user_prefs_upsert_own
      on public.user_prefs for insert with check (auth.uid() = user_id);
    create policy user_prefs_update_own
      on public.user_prefs for update using (auth.uid() = user_id);
  end if;
end$$;
