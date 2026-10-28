-- PBB Heirs: true NAME + PASSWORD sign-ins (no email and no anonymous Supabase Auth).
-- Run ONCE in the SQL Editor of your EXISTING Supabase project, AFTER SETUP_PBB_VOTING.sql.
-- All new objects begin pbb_. Your 3L EVE2 lq_ tables are untouched.
-- This script preserves the existing pbb_house_state and pbb_votes data.
-- Uses pgcrypto's bcrypt crypt() for password hashing and random 256-bit session tokens.

begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.pbb_vote_accounts (
  uid uuid primary key default gen_random_uuid(),
  name text not null,
  password_hash text not null,
  is_host boolean not null default false,
  created_at timestamptz not null default now(),
  constraint pbb_account_name_length check (char_length(btrim(name)) between 2 and 50)
);
create unique index if not exists pbb_vote_accounts_name_lower_unique
  on public.pbb_vote_accounts (lower(btrim(name)));

create table if not exists public.pbb_vote_sessions (
  token_hash text primary key,
  uid uuid not null references public.pbb_vote_accounts(uid) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists pbb_vote_sessions_uid_idx on public.pbb_vote_sessions(uid);

alter table public.pbb_vote_accounts enable row level security;
alter table public.pbb_vote_sessions enable row level security;
revoke all on public.pbb_vote_accounts from public, anon, authenticated;
revoke all on public.pbb_vote_sessions from public, anon, authenticated;

-- The shared voting state is publicly READABLE. Only PBB host RPC may write it.
grant select on public.pbb_house_state to anon;
drop policy if exists "pbb public voting state read" on public.pbb_house_state;
create policy "pbb public voting state read" on public.pbb_house_state
  for select to anon using (true);

-- Private helpers; only security-definer functions below may call them.
create or replace function public.pbb_issue_session(p_uid uuid)
returns text language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
declare v_token text;
begin
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.pbb_vote_sessions(token_hash, uid, expires_at)
    values (encode(digest(v_token, 'sha256'),'hex'), p_uid, now() + interval '36 hours');
  return v_token;
end $$;

create or replace function public.pbb_auth_uid(p_token text)
returns uuid language plpgsql stable security definer
set search_path = public, extensions, pg_temp as $$
declare v_uid uuid;
begin
  select s.uid into v_uid from public.pbb_vote_sessions s
  where s.token_hash = encode(digest(coalesce(p_token,''),'sha256'),'hex')
    and s.expires_at > now();
  if v_uid is null then raise exception 'Session expired. Please sign in again.'; end if;
  return v_uid;
end $$;

create or replace function public.pbb_auth_host(p_token text)
returns uuid language plpgsql stable security definer
set search_path = public, extensions, pg_temp as $$
declare v_uid uuid;
begin
  v_uid := public.pbb_auth_uid(p_token);
  if not exists (select 1 from public.pbb_vote_accounts where uid=v_uid and is_host=true) then
    raise exception 'Only Ben / the authorized host may control voting.';
  end if;
  return v_uid;
end $$;

-- A voter can CREATE an account from the phone; a duplicate name is rejected.
create or replace function public.pbb_register(p_name text, p_password text)
returns jsonb language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
declare v_name text := regexp_replace(btrim(coalesce(p_name,'')), '[[:space:]]+', ' ', 'g');
        v_uid uuid; v_token text;
begin
  if char_length(v_name) < 2 or char_length(v_name)>50 then raise exception 'Name must be between 2 and 50 characters.'; end if;
  if char_length(coalesce(p_password,'')) < 8 then raise exception 'Password must be at least 8 characters.'; end if;
  if char_length(p_password) > 72 then raise exception 'Password must be at most 72 characters.'; end if;
  insert into public.pbb_vote_accounts(name,password_hash)
    values (v_name, crypt(p_password,gen_salt('bf',10))) returning uid into v_uid;
  v_token := public.pbb_issue_session(v_uid);
  return jsonb_build_object('token',v_token,'name',v_name,'is_host',false);
exception when unique_violation then
  raise exception 'That name is already registered. Sign in, or use a more specific name.';
end $$;

create or replace function public.pbb_login(p_name text, p_password text)
returns jsonb language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
declare v_account public.pbb_vote_accounts%rowtype; v_token text;
begin
  select * into v_account from public.pbb_vote_accounts
    where lower(btrim(name))=lower(btrim(coalesce(p_name,''))) limit 1;
  if v_account.uid is null or coalesce(crypt(coalesce(p_password,''),v_account.password_hash),'') <> v_account.password_hash then
    raise exception 'Incorrect name or password.';
  end if;
  v_token := public.pbb_issue_session(v_account.uid);
  return jsonb_build_object('token',v_token,'name',v_account.name,'is_host',v_account.is_host);
end $$;

create or replace function public.pbb_whoami(p_token text)
returns jsonb language sql stable security definer
set search_path = public, extensions, pg_temp as $$
  select jsonb_build_object('name',a.name,'is_host',a.is_host)
  from public.pbb_vote_sessions s join public.pbb_vote_accounts a on a.uid=s.uid
  where s.token_hash=encode(digest(coalesce(p_token,''),'sha256'),'hex')
    and s.expires_at>now() limit 1;
$$;

create or replace function public.pbb_logout(p_token text)
returns void language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
begin
  delete from public.pbb_vote_sessions
    where token_hash=encode(digest(coalesce(p_token,''),'sha256'),'hex');
end $$;

create or replace function public.pbb_my_vote(p_token text, p_round text)
returns text language plpgsql stable security definer
set search_path = public, extensions, pg_temp as $$
declare v_uid uuid; v_choice text;
begin
  v_uid := public.pbb_auth_uid(p_token);
  select choice into v_choice from public.pbb_votes where voter_id=v_uid and round_id=p_round;
  return v_choice;
end $$;

create or replace function public.pbb_submit_vote(p_token text, p_round text, p_choice text)
returns void language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
declare v_uid uuid; v_state public.pbb_house_state%rowtype;
begin
  v_uid := public.pbb_auth_uid(p_token);
  select * into v_state from public.pbb_house_state where id=1 for share;
  if v_state.status is distinct from 'open' or v_state.active_round is distinct from p_round then
    raise exception 'Voting is closed for this round.';
  end if;
  insert into public.pbb_votes(round_id,voter_id,choice) values (p_round,v_uid,p_choice);
exception when unique_violation then
  raise exception 'You already voted in this round.';
end $$;

create or replace function public.pbb_private_votes(p_token text, p_round text)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions, pg_temp as $$
declare v_counts jsonb;
begin
  perform public.pbb_auth_host(p_token);
  select coalesce(jsonb_object_agg(voter_id::text, choice),'{}'::jsonb) into v_counts
    from public.pbb_votes where round_id=p_round;
  return v_counts;
end $$;

create or replace function public.pbb_update_show(p_token text, p_patch jsonb)
returns void language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
begin
  perform public.pbb_auth_host(p_token);
  if p_patch is null or jsonb_typeof(p_patch) <> 'object'
     or (p_patch - 'activeRound' - 'status' - 'showResults' - 'resultSummary') <> '{}'::jsonb then
    raise exception 'Invalid voting state update.';
  end if;
  update public.pbb_house_state set
    active_round = case when p_patch ? 'activeRound' then p_patch->>'activeRound' else active_round end,
    status = case when p_patch ? 'status' then p_patch->>'status' else status end,
    show_results = case when p_patch ? 'showResults' then (p_patch->>'showResults')::boolean else show_results end,
    result_summary = case when p_patch ? 'resultSummary' then p_patch->'resultSummary' else result_summary end
  where id=1;
end $$;

create or replace function public.pbb_clear_round(p_token text, p_round text)
returns void language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
begin
  perform public.pbb_auth_host(p_token);
  if not exists(select 1 from public.pbb_house_state where id=1 and status <> 'open') then
    raise exception 'Close voting before resetting a round.';
  end if;
  delete from public.pbb_votes where round_id=p_round;
end $$;

-- Never allow direct client access to the account/session tables or helpers.
revoke all on function public.pbb_issue_session(uuid) from public,anon,authenticated;
revoke all on function public.pbb_auth_uid(text) from public,anon,authenticated;
revoke all on function public.pbb_auth_host(text) from public,anon,authenticated;

-- These are the only browser-facing operations. All require password or session token
-- except registering; no password hashes are ever returned to the browser.
revoke all on function public.pbb_register(text,text) from public,authenticated;
revoke all on function public.pbb_login(text,text) from public,authenticated;
revoke all on function public.pbb_whoami(text) from public,authenticated;
revoke all on function public.pbb_logout(text) from public,authenticated;
revoke all on function public.pbb_my_vote(text,text) from public,authenticated;
revoke all on function public.pbb_submit_vote(text,text,text) from public,authenticated;
revoke all on function public.pbb_private_votes(text,text) from public,authenticated;
revoke all on function public.pbb_update_show(text,jsonb) from public,authenticated;
revoke all on function public.pbb_clear_round(text,text) from public,authenticated;
grant execute on function public.pbb_register(text,text) to anon;
grant execute on function public.pbb_login(text,text) to anon;
grant execute on function public.pbb_whoami(text) to anon;
grant execute on function public.pbb_logout(text) to anon;
grant execute on function public.pbb_my_vote(text,text) to anon;
grant execute on function public.pbb_submit_vote(text,text,text) to anon;
grant execute on function public.pbb_private_votes(text,text) to anon;
grant execute on function public.pbb_update_show(text,jsonb) to anon;
grant execute on function public.pbb_clear_round(text,text) to anon;
commit;

-- FINAL HOST STEP (run SEPARATELY only AFTER Ben registers through index.html):
-- update public.pbb_vote_accounts set is_host = true where lower(btrim(name)) = lower('Ben');
-- This grants CONTROL ROOM permissions to the registered name "Ben".
-- Do NOT promote all users. Ben can sign in at host.html with the SAME name/password.
