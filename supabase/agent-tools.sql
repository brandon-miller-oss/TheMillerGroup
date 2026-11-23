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
--   Transactions (deals/*)            the agent on the deal, and the broker
--   Company hub, partners, brand,     every agent reads; only the broker edits
--   commission plan (company/*)
--   Agent websites and landing pages  everyone reads published pages; the agent
--   (sites/<agent>/pages/*)           who owns them (and the broker) edits
--   Cost facts (costfacts/<listing>)  everyone reads; any agent edits; only the
--                                     broker edits costfacts/config
--   Showing coverage (coverage/<id>)  every agent reads; the posting agent edits;
--                                     others claim through claim_coverage(); the
--                                     access notes (coverage/<id>/access) are only
--                                     for the posting agent and whoever claimed it
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

drop policy if exists docs_read on public.docs;
drop function if exists public.can_read_doc(text);
create or replace function public.can_read_doc(p text, d jsonb) returns boolean
language sql stable as $$
  select
    public.doc_top(p) in ('exclusives', 'openhouses', 'showcase', 'team', 'costfacts')
    or (public.doc_top(p) = 'coverage' and public.is_agent() and (array_length(string_to_array(p, '/'), 1) = 2
          or exists (select 1 from public.docs c where c.path = 'coverage/' || public.doc_owner(p)
                     and (c.data->>'agentId' = auth.uid()::text or c.data->>'claimedBy' = auth.uid()::text))))
    or (public.doc_top(p) = 'company' and (public.is_agent() or p like 'company/brandok/items/%'))  -- brand approvals are public so agent pages can show approved brands
    or (public.doc_top(p) = 'deals' and public.is_agent() and d->>'agentId' = auth.uid()::text)
    or public.is_admin()
    or (auth.uid() is not null and public.doc_top(p) in ('boards', 'leads', 'threads') and (
          public.doc_owner(p) = auth.uid()::text
          or (public.is_agent() and public.client_agent(public.doc_owner(p)) = auth.uid()::text)))
    or (public.doc_top(p) = 'agent' and public.is_agent() and public.doc_owner(p) = auth.uid()::text)
    or (public.doc_top(p) = 'sites' and (coalesce((d->>'published')::boolean, false) or (public.is_agent() and public.doc_owner(p) = auth.uid()::text)));
$$;

-- d is the row's data (new data for inserts, current data for updates/deletes)
create or replace function public.can_write_doc(p text, d jsonb) returns boolean
language sql stable as $$
  select auth.uid() is not null and (
    public.is_admin()
    or (public.doc_top(p) in ('boards', 'leads', 'threads') and (
          public.doc_owner(p) = auth.uid()::text
          or (public.is_agent() and public.client_agent(public.doc_owner(p)) = auth.uid()::text)))
    or (public.doc_top(p) in ('agent', 'team', 'sites') and public.is_agent() and public.doc_owner(p) = auth.uid()::text)
    or (public.doc_top(p) in ('exclusives', 'openhouses', 'showcase', 'deals') and public.is_agent() and d->>'agentId' = auth.uid()::text)
    or (public.doc_top(p) = 'costfacts' and p <> 'costfacts/config' and public.is_agent())
    or (public.doc_top(p) = 'coverage' and public.is_agent() and (
          (array_length(string_to_array(p, '/'), 1) = 2 and d->>'agentId' = auth.uid()::text)
          or (array_length(string_to_array(p, '/'), 1) = 3 and exists (select 1 from public.docs c where c.path = 'coverage/' || public.doc_owner(p) and c.data->>'agentId' = auth.uid()::text)))));
-- company/* falls through to is_admin() only.
$$;

drop policy if exists docs_read on public.docs;
drop policy if exists docs_insert on public.docs;
drop policy if exists docs_update on public.docs;
drop policy if exists docs_delete on public.docs;
create policy docs_read on public.docs for select using (public.can_read_doc(path, data));
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

-- ---------- Leads from agent websites and landing pages ----------
-- Anyone can submit a form on a PUBLISHED agent page. The lead goes to the
-- brokerage lead list (public.leads) and straight into that agent's contacts.
create or replace function public.submit_agent_lead(p_agent text, p_page text, p_name text, p_email text,
  p_phone text default null, p_address text default null, p_message text default null, p_purpose text default 'contact',
  p_utm jsonb default '{}'::jsonb, p_referrer text default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare pg jsonb; cid text; r text; nm text := trim(coalesce(p_name, '')); em text := lower(trim(coalesce(p_email, '')));
begin
  if p_agent !~ '^[A-Za-z0-9_\-]{1,64}$' or p_page !~ '^[A-Za-z0-9_\-]{1,64}$' then raise exception 'Page not found'; end if;
  if not exists (select 1 from public.agents where user_id::text = p_agent) and not exists (select 1 from public.admins where user_id::text = p_agent) then raise exception 'Page not found'; end if;
  select data into pg from public.docs where path = 'sites/' || p_agent || '/pages/' || p_page and coalesce((data->>'published')::boolean, false);
  if pg is null then raise exception 'Page not found'; end if;
  if char_length(nm) not between 1 and 200 or char_length(em) > 320 or em !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Please add a name and a valid email'; end if;
  if (select count(*) from public.leads where landing_slug = left(p_agent || '/' || p_page, 200) and created_at > now() - interval '1 hour') >= 30 then raise exception 'Too many requests. Try again later.'; end if;
  insert into public.leads (name, email, phone, interest, message, address, source, landing_slug, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, extra)
  values (nm, em, left(nullif(trim(p_phone), ''), 40), left(coalesce(p_purpose, 'contact') || ': ' || coalesce(pg->>'title', p_page), 120), left(p_message, 5000), left(p_address, 300), 'agent-page',
    left(p_agent || '/' || p_page, 200), left(p_utm->>'utm_source', 120), left(p_utm->>'utm_medium', 120), left(p_utm->>'utm_campaign', 120), left(p_utm->>'utm_content', 120), left(p_utm->>'utm_term', 120),
    left(p_referrer, 300), jsonb_build_object('agentId', p_agent, 'pageId', p_page));
  r := case when p_purpose = 'valuation' then 'seller' else 'buyer' end;
  cid := 'web' || replace(gen_random_uuid()::text, '-', '');
  insert into public.docs (path, parent, data) values ('agent/' || p_agent || '/crm/contacts/' || cid, 'agent/' || p_agent || '/crm/contacts',
    jsonb_strip_nulls(jsonb_build_object('name', nm, 'email', em, 'phone', left(nullif(trim(p_phone), ''), 40), 'role', r,
      'buyerStage', case when r = 'buyer' then 'lead' end, 'sellerStage', case when r = 'seller' then 'prospect' end,
      'listingAddress', left(p_address, 300), 'source', left('Website: ' || coalesce(pg->>'title', p_page), 200),
      'notes', left(concat_ws(E'\n', 'Came in from ' || coalesce(pg->>'title', p_page) || ' (' || coalesce(p_purpose, 'contact') || ').', nullif(p_message, ''), nullif(concat_ws(' / ', p_utm->>'utm_source', p_utm->>'utm_campaign'), '')), 5000),
      'folders', jsonb_build_array('Website leads'), 'createdAt', now(), 'updatedAt', now())));
  return true;
end $$;
revoke all on function public.submit_agent_lead(text, text, text, text, text, text, text, text, jsonb, text) from public;
grant execute on function public.submit_agent_lead(text, text, text, text, text, text, text, text, jsonb, text) to anon, authenticated;

-- ---------- Showing coverage: claim or release a request ----------
-- Any agent except the one who posted it can claim an open request. Only the
-- agent who claimed it can release it. Fees are paid by the brokerage.
create or replace function public.claim_coverage(p_id text, p_take boolean default true) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur jsonb; who text := auth.uid()::text; nm text;
begin
  if not public.is_agent() then raise exception 'Only agents can claim coverage'; end if;
  select data into cur from public.docs where path = 'coverage/' || p_id for update;
  if cur is null then raise exception 'That request is gone'; end if;
  if p_take then
    if cur->>'agentId' = who then raise exception 'You posted this one'; end if;
    if coalesce(cur->>'status', 'open') <> 'open' or coalesce(cur->>'claimedBy', '') <> '' then raise exception 'Someone already claimed this'; end if;
    select data->>'name' into nm from public.docs where path = 'team/' || who;
    cur := cur || jsonb_build_object('status', 'claimed', 'claimedBy', who, 'claimedName', coalesce(nm, ''), 'claimedAt', now());
  else
    if cur->>'claimedBy' is distinct from who then raise exception 'You haven''t claimed this'; end if;
    cur := (cur - 'claimedBy' - 'claimedName' - 'claimedAt') || jsonb_build_object('status', 'open', 'releasedAt', now());
  end if;
  update public.docs set data = cur, updated_at = now() where path = 'coverage/' || p_id;
  return cur;
end $$;
revoke all on function public.claim_coverage(text, boolean) from public, anon;
grant execute on function public.claim_coverage(text, boolean) to authenticated;

-- ---------- Live updates ----------
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- ---------- Leads from an agent's own website (Connect your website) ----------
-- The contact form snippet posts here. The lead goes to the brokerage lead list and
-- into that agent's contacts (folder: Website leads). Limited to 30 an hour per agent.
create or replace function public.submit_website_lead(p_agent text, p_name text, p_email text,
  p_phone text default null, p_message text default null, p_page_url text default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare cid text; nm text := trim(coalesce(p_name, '')); em text := lower(trim(coalesce(p_email, '')));
  ph text := left(nullif(trim(coalesce(p_phone, '')), ''), 40); src text := left(coalesce(nullif(trim(p_page_url), ''), 'Agent website'), 300);
begin
  if p_agent !~ '^[A-Za-z0-9_\-]{1,64}$' then raise exception 'Unknown agent'; end if;
  if not exists (select 1 from public.agents where user_id::text = p_agent) and not exists (select 1 from public.admins where user_id::text = p_agent) then raise exception 'Unknown agent'; end if;
  if char_length(nm) not between 1 and 200 or char_length(em) > 320 or em !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Please add a name and a valid email'; end if;
  if (select count(*) from public.leads where source = 'agent-website' and extra->>'agentId' = p_agent and created_at > now() - interval '1 hour') >= 30 then raise exception 'Too many requests. Try again later.'; end if;
  insert into public.leads (name, email, phone, interest, message, source, referrer, extra)
  values (nm, em, ph, 'Website inquiry', left(p_message, 5000), 'agent-website', src, jsonb_build_object('agentId', p_agent));
  cid := 'web' || replace(gen_random_uuid()::text, '-', '');
  insert into public.docs (path, parent, data) values ('agent/' || p_agent || '/crm/contacts/' || cid, 'agent/' || p_agent || '/crm/contacts',
    jsonb_strip_nulls(jsonb_build_object('name', nm, 'email', em, 'phone', ph, 'role', 'buyer', 'buyerStage', 'lead',
      'source', left('Website: ' || src, 200), 'notes', left(coalesce(p_message, ''), 5000),
      'folders', jsonb_build_array('Website leads'), 'createdAt', now(), 'updatedAt', now())));
  return true;
end $$;
revoke all on function public.submit_website_lead(text, text, text, text, text, text) from public;
grant execute on function public.submit_website_lead(text, text, text, text, text, text) to anon, authenticated;
