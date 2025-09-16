-- Enable useful extensions
id bigserial primary key,
session_id uuid not null references public.chat_sessions(id) on delete cascade,
role text not null check (role in ('user','assistant','system')),
content text not null,
created_at timestamptz not null default now()
);
create index if not exists idx_chat_messages_session on public.chat_messages(session_id);


-- RLS
alter table public.users enable row level security;
alter table public.birth_data enable row level security;
alter table public.chart_points enable row level security;
alter table public.natal_aspects enable row level security;
alter table public.transit_events enable row level security;
alter table public.interpretations enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;


-- policies: users (owner read/update)
create policy users_select_own on public.users
for select using (id = auth.uid());
create policy users_update_own on public.users
for update using (id = auth.uid()) with check (id = auth.uid());
-- no insert/delete by clients


-- policies: tables with user_id (owner-only full access)
create policy bd_rw_own on public.birth_data
for all using (user_id = auth.uid()) with check (user_id = auth.uid());


create policy cp_rw_own on public.chart_points
for all using (user_id = auth.uid()) with check (user_id = auth.uid());


create policy na_rw_own on public.natal_aspects
for all using (user_id = auth.uid()) with check (user_id = auth.uid());


create policy te_rw_own on public.transit_events
for all using (user_id = auth.uid()) with check (user_id = auth.uid());


create policy cs_rw_own on public.chat_sessions
for all using (user_id = auth.uid()) with check (user_id = auth.uid());


create policy cm_read_by_session on public.chat_messages
for select using (exists (
select 1 from public.chat_sessions s
where s.id = chat_messages.session_id and s.user_id = auth.uid()
));
create policy cm_write_by_session on public.chat_messages
for insert with check (exists (
select 1 from public.chat_sessions s
where s.id = chat_messages.session_id and s.user_id = auth.uid()
));


-- interpretations: readable by anyone, writable only with service role
create policy interp_public_read on public.interpretations
for select using (true);
-- (no insert/update/delete policy for anon/auth; use service role key in server routes)