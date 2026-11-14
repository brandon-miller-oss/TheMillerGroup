-- =====================================================================
-- The Miller Group: home search + agent tools (multi-agent)
-- Run AFTER schema.sql. Paste into Supabase > SQL Editor > New query > Run.
-- Safe to run more than once.
--
-- Who sees what:
--   Broker (anyone in public.admins)  everything
--   Agent  (public.agents)            their own CRM, plus the clients assigned to them
--   Client (any signed-in user)       their own shortlists, searches, requests, messages
--   Everyone, signed in or not        published off-market listings, open houses,
--                                     Miller Picks, and the Team page
-- =====================================================================

create table if not exists public.docs (
  path text primary key,
  parent text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint docs_parent_matches check (parent = regexp_replace(path, '/[^/]+$', '')),
  constraint docs_path_shape check (path ~ '^[A-Za-z0-9_\-]+(/[A-Za-z0-9_\-]+)+$' or path ~ '^[A-Za-z0-9_\-]+$')
);
create index if not exists docs_parent_idx on public.docs (parent);

create table if not exists public.agents (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.docs enable row level security;
alter table public.agents enable row level security;

-- ---------- Roles ----------
create or replace function public.is_agent() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    exists (select 1 from public.agents where user_id = auth.uid()) or public.is_admin());
$$;
grant execute on function public.is_agent() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- The agent a client belongs to, stored on boards/<client id>.agentId
create or replace function public.client_agent(client text) returns text
language sql stable security definer set search_path = public as $$
  select data->>'agentId' from public.docs where path = 'boards/' || client;
$$;

create or replace function public.doc_top(p text) returns text language sql immutable as $$ select split_part(p, '/', 1) $$;
create or replace function public.doc_owner(p text) returns text language sql immutable as $$ select split_part(p, '/', 2) $$;

create or replace function public.can_read_doc(p text) returns boolean
language sql stable as $$
  select
    public.doc_top(p) in ('exclusives', 'openhouses', 'showcase', 'team')
    or public.is_admin()
    or (auth.uid() is not null and public.doc_top(p) in ('boards', 'leads', 'threads') and (
          public.doc_owner(p) = auth.uid()::text
          or (public.is_agent() and public.client_agent(public.doc_owner(p)) = auth.uid()::text)))
    or (public.doc_top(p) = 'agent' and public.is_agent() and public.doc_owner(p) = auth.uid()::text);
$$;

-- d is the row's data (new data for inserts, current data for updates/deletes)
create or replace function public.can_write_doc(p text, d jsonb) returns boolean
language sql stable as $$
  select auth.uid() is not null and (
    public.is_admin()
    or (public.doc_top(p) in ('boards', 'leads', 'threads') and (
          public.doc_owner(p) = auth.uid()::text
          or (public.is_agent() and public.client_agent(public.doc_owner(p)) = auth.uid()::text)))
    or (public.doc_top(p) in ('agent', 'team') and public.is_agent() and public.doc_owner(p) = auth.uid()::text)
    or (public.doc_top(p) in ('exclusives', 'openhouses', 'showcase') and public.is_agent() and d->>'agentId' = auth.uid()::text));
$$;

drop policy if exists docs_read on public.docs;
drop policy if exists docs_insert on public.docs;
drop policy if exists docs_update on public.docs;
drop policy if exists docs_delete on public.docs;
create policy docs_read on public.docs for select using (public.can_read_doc(path));
create policy docs_insert on public.docs for insert with check (public.can_write_doc(path, data));
create policy docs_update on public.docs for update using (public.can_write_doc(path, data)) with check (public.can_write_doc(path, data));
create policy docs_delete on public.docs for delete using (public.can_write_doc(path, data));

drop policy if exists agents_read on public.agents;
create policy agents_read on public.agents for select using (user_id = auth.uid() or public.is_admin());

-- ---------- Broker tools: add and remove agents ----------
create or replace function public.add_agent(agent_email text) returns boolean
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Only the broker can add agents'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(agent_email)) limit 1;
  if uid is null then return false; end if;
  insert into public.agents (user_id) values (uid) on conflict do nothing;
  return true;
end $$;

create or replace function public.remove_agent(agent_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only the broker can remove agents'; end if;
  delete from public.agents where user_id = agent_id;
end $$;

revoke all on function public.add_agent(text) from public, anon;
revoke all on function public.remove_agent(uuid) from public, anon;
grant execute on function public.add_agent(text) to authenticated;
grant execute on function public.remove_agent(uuid) to authenticated;

-- ---------- Live updates ----------
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;
