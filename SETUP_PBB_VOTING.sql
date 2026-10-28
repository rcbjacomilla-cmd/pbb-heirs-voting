-- INITIAL setup for a NEW project only. For an existing PBB installation,
-- do NOT rerun this; run SETUP_NAME_PASSWORD.sql instead.
-- For new projects, run this first and then SETUP_NAME_PASSWORD.sql.
-- The legacy Anonymous/Email Auth instructions below are superseded by
-- SETUP_NAME_PASSWORD.sql. DO NOT enable Anonymous sign-in for the new site.
-- PINOY BIG HEIR — ADD THIS TO YOUR EXISTING 3L EVE2 SUPABASE PROJECT.
-- Run in Supabase SQL Editor. The script creates NEW pbb_ objects ONLY.
-- It does NOT drop, rename, or alter your existing lq_ study tables.
-- After you create a host in Authentication > Users, follow the HOST UID step at the bottom.

begin;

create table if not exists public.pbb_hosts (
  uid uuid primary key
);

create table if not exists public.pbb_house_state (
  id integer primary key default 1 check (id = 1),
  active_round text not null default 'eviction' check (active_round in ('eviction','final-demi-jara','final-dex-jara','diaz-quiz')),
  status text not null default 'waiting' check (status in ('waiting','open','closed')),
  show_results boolean not null default false,
  result_summary jsonb
);

insert into public.pbb_house_state(id,active_round,status,show_results,result_summary)
values(1,'eviction','waiting',false,null)
on conflict (id) do nothing;

create table if not exists public.pbb_votes (
  round_id text not null,
  voter_id uuid not null,
  choice text not null,
  created_at timestamptz not null default now(),
  primary key (round_id,voter_id),
  constraint pbb_valid_choice check ((round_id,choice) in (
    ('eviction','dex'),('eviction','demi'),
    ('final-demi-jara','demi'),('final-demi-jara','jara'),
    ('final-dex-jara','dex'),('final-dex-jara','jara'),
    ('diaz-quiz','bbs'),('diaz-quiz','bbe')
  ))
);

create or replace function public.pbb_is_host()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists(select 1 from public.pbb_hosts where uid = (select auth.uid()));
$$;

-- Do NOT permit the web client to add arbitrary host UIDs.
revoke all on public.pbb_hosts from anon,authenticated;
revoke all on public.pbb_house_state from anon,authenticated;
revoke all on public.pbb_votes from anon,authenticated;
revoke all on function public.pbb_is_host() from public,anon;
grant execute on function public.pbb_is_host() to authenticated;
grant select,update on public.pbb_house_state to authenticated;
grant select,insert,delete on public.pbb_votes to authenticated;

alter table public.pbb_hosts enable row level security;
alter table public.pbb_house_state enable row level security;
alter table public.pbb_votes enable row level security;

-- pbb_hosts deliberately has no web-client SELECT/INSERT/UPDATE/DELETE policies.
-- Only the SQL Editor/admin may insert host UIDs; pbb_is_host reads it securely.

drop policy if exists "pbb state read" on public.pbb_house_state;
create policy "pbb state read" on public.pbb_house_state
for select to authenticated using (true);

drop policy if exists "pbb state host update" on public.pbb_house_state;
create policy "pbb state host update" on public.pbb_house_state
for update to authenticated using (public.pbb_is_host()) with check (public.pbb_is_host());

drop policy if exists "pbb votes read own or host" on public.pbb_votes;
create policy "pbb votes read own or host" on public.pbb_votes
for select to authenticated using (voter_id = (select auth.uid()) or public.pbb_is_host());

drop policy if exists "pbb one authorized vote" on public.pbb_votes;
create policy "pbb one authorized vote" on public.pbb_votes
for insert to authenticated with check (
  voter_id = (select auth.uid())
  and exists(
    select 1 from public.pbb_house_state s
    where s.id=1 and s.status='open' and s.active_round=pbb_votes.round_id
  )
);

drop policy if exists "pbb host reset vote" on public.pbb_votes;
create policy "pbb host reset vote" on public.pbb_votes
for delete to authenticated using (public.pbb_is_host());

-- Enable Realtime for only these new tables. Do not replace the publication:
-- replacing it could break Realtime on your study website.
do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='pbb_house_state') then
      alter publication supabase_realtime add table public.pbb_house_state;
    end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='pbb_votes') then
      alter publication supabase_realtime add table public.pbb_votes;
    end if;
  end if;
end $$;

commit;

-- LEGACY INSTRUCTIONS (IGNORE FOR NAME + PASSWORD): Go to Supabase Authentication > Users and create Ben's
-- EMAIL + PASSWORD account. Copy Ben's User UID (not email or password).
-- Run the following line separately after replacing the placeholder:
-- insert into public.pbb_hosts(uid) values ('PASTE_BENS_USER_UUID') on conflict do nothing;
--
-- Keep the host password private. Enable Authentication > Providers > Anonymous
-- so classmates can vote without creating accounts. Enable Email for Ben.
-- Never put your service_role/secret key into GitHub files.

-- NEW LOGIN: see SETUP_NAME_PASSWORD.sql. Register Ben on the viewer page, then promote his name as host.
