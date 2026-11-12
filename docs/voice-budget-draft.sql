-- DRAFT ONLY. Not applied or enabled. Canonical deployment belongs in platform's
-- Supabase migrations, followed by its reviewed deployment workflow.
-- Both websites share ONE budget row. No grant row is seeded by this draft.
begin;
create table public.voice_pilot_budgets (
  id text primary key check(id='websites'),
  enabled boolean not null default false,
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  cap_micro_usd bigint not null check(cap_micro_usd between 250000 and 8000000),
  check(expires_at>starts_at)
);
create table public.voice_pilot_requests (
  site text not null check(site in ('personal','firstunit')),
  id uuid not null,
  token_hash text not null check(token_hash ~ '^[0-9a-f]{64}$'),
  payload_hash text not null check(payload_hash ~ '^[0-9a-f]{64}$'),
  rate_key text not null check(rate_key ~ '^[0-9a-f]{64}$'),
  reserved_micro_usd bigint not null check(reserved_micro_usd=250000),
  charged_micro_usd bigint check(charged_micro_usd>=0),
  state text not null check(state in ('pending','complete','rejected','unknown','failed')),
  provider_id text,
  result text,
  result_expires_at bigint not null default 0,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  primary key(site,id)
);
alter table public.voice_pilot_budgets enable row level security;
alter table public.voice_pilot_requests enable row level security;
revoke all on public.voice_pilot_budgets,public.voice_pilot_requests from public,anon,authenticated;
grant select,insert,update on public.voice_pilot_budgets,public.voice_pilot_requests to service_role;
create index voice_pilot_rate_idx on public.voice_pilot_requests(rate_key,created_at);

create function public.voice_pilot_health(p_site text) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('available',coalesce((select enabled and now() between starts_at and expires_at
    and coalesce((select sum(coalesce(charged_micro_usd,reserved_micro_usd)) from voice_pilot_requests),0)+250000<=cap_micro_usd
    from voice_pilot_budgets where id='websites'),false) and p_site in ('personal','firstunit'));
$$;

create function public.voice_pilot_begin(p_site text,p_id uuid,p_token_hash text,p_payload_hash text,p_rate_key text,p_reserve bigint)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b voice_pilot_budgets; r voice_pilot_requests; used bigint;
begin
  if p_site not in ('personal','firstunit') or p_reserve<>250000 or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_payload_hash !~ '^[0-9a-f]{64}$' or p_rate_key !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_voice_request';
  end if;
  select * into b from voice_pilot_budgets where id='websites' for update;
  if not found then return jsonb_build_object('status','budget_unavailable'); end if;
  select * into r from voice_pilot_requests where site=p_site and id=p_id;
  if found then
    if r.token_hash<>p_token_hash or r.payload_hash<>p_payload_hash then raise exception 'request_conflict'; end if;
    return jsonb_build_object('status','existing');
  end if;
  if not b.enabled or now()<b.starts_at or now()>=b.expires_at then return jsonb_build_object('status','budget_unavailable'); end if;
  select coalesce(sum(coalesce(charged_micro_usd,reserved_micro_usd)),0) into used from voice_pilot_requests;
  if used+p_reserve>b.cap_micro_usd then return jsonb_build_object('status','budget_unavailable'); end if;
  if (select count(*) from voice_pilot_requests where rate_key=p_rate_key and created_at>now()-interval '1 day')>=12
    or exists(select 1 from voice_pilot_requests where rate_key=p_rate_key and created_at>now()-interval '3 seconds') then
    return jsonb_build_object('status','rate_limited');
  end if;
  insert into voice_pilot_requests(site,id,token_hash,payload_hash,rate_key,reserved_micro_usd,state)
    values(p_site,p_id,p_token_hash,p_payload_hash,p_rate_key,p_reserve,'pending');
  -- Output recovery expires in ten minutes. Physical ciphertext cleanup happens
  -- on later admission, not on a guaranteed timed-deletion schedule.
  update voice_pilot_requests set result=null where result_expires_at<extract(epoch from now())*1000 and result is not null;
  return jsonb_build_object('status','admitted');
end;
$$;

create function public.voice_pilot_finish(p_site text,p_id uuid,p_token_hash text,p_state text,p_charged bigint,p_provider_id text,p_result text,p_result_expires_at bigint)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r voice_pilot_requests;
begin
  perform 1 from voice_pilot_budgets where id='websites' for update;
  select * into r from voice_pilot_requests where site=p_site and id=p_id and token_hash=p_token_hash for update;
  if not found then raise exception 'request_not_found'; end if;
  if r.state in ('complete','rejected','failed') then return jsonb_build_object('ok',true); end if;
  if p_state not in ('complete','rejected','unknown','failed') or p_charged<0 or length(p_result)>6000000
    or (p_state='unknown' and p_charged is not null) or (p_state='rejected' and p_charged is distinct from 0)
    or (p_state='complete' and p_result is null) or p_result_expires_at>extract(epoch from now()+interval '11 minutes')*1000 then
    raise exception 'invalid_voice_result';
  end if;
  update voice_pilot_requests set state=p_state,charged_micro_usd=p_charged,provider_id=left(p_provider_id,200),
    result=p_result,result_expires_at=p_result_expires_at,finished_at=now() where site=p_site and id=p_id;
  if p_charged>r.reserved_micro_usd then update voice_pilot_budgets set enabled=false where id='websites'; end if;
  return jsonb_build_object('ok',true);
end;
$$;

create function public.voice_pilot_recover(p_site text,p_id uuid,p_token_hash text) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select jsonb_build_object('state',state,'createdAt',extract(epoch from created_at)*1000,
  'result',case when result_expires_at>extract(epoch from now())*1000 then result else null end,'resultExpiresAt',result_expires_at)
  from voice_pilot_requests where site=p_site and id=p_id and token_hash=p_token_hash),jsonb_build_object('state','missing'));
$$;
revoke all on function public.voice_pilot_health(text),public.voice_pilot_begin(text,uuid,text,text,text,bigint),
 public.voice_pilot_finish(text,uuid,text,text,bigint,text,text,bigint),public.voice_pilot_recover(text,uuid,text) from public,anon,authenticated;
grant execute on function public.voice_pilot_health(text),public.voice_pilot_begin(text,uuid,text,text,text,bigint),
 public.voice_pilot_finish(text,uuid,text,text,bigint,text,text,bigint),public.voice_pilot_recover(text,uuid,text) to service_role;
commit;
