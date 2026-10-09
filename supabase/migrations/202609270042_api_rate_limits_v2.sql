-- BRASIVO — distributed API abuse protection V2
-- Stores only HMAC-derived bucket keys. Raw client IPs are never persisted here.

create table if not exists public.api_rate_limits (
  bucket_key text primary key,
  policy text not null,
  request_count integer not null default 0 check (request_count >= 0),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists api_rate_limits_expires_at_idx
  on public.api_rate_limits (expires_at);

alter table public.api_rate_limits enable row level security;

revoke all on table public.api_rate_limits from anon;
revoke all on table public.api_rate_limits from authenticated;

create or replace function public.consume_api_rate_limits(
  p_bucket_keys text[],
  p_policy text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_new_expiry timestamptz;
  v_key text;
  v_count integer;
  v_expiry timestamptz;
  v_max_count integer := 0;
  v_earliest_expiry timestamptz := null;
begin
  if p_limit < 1 or p_limit > 100000 then
    raise exception 'invalid limit';
  end if;

  if p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid window';
  end if;

  if coalesce(array_length(p_bucket_keys, 1), 0) < 1
     or array_length(p_bucket_keys, 1) > 4 then
    raise exception 'invalid bucket key count';
  end if;

  if length(coalesce(p_policy, '')) < 1 or length(p_policy) > 160 then
    raise exception 'invalid policy';
  end if;

  v_new_expiry := v_now + make_interval(secs => p_window_seconds);

  foreach v_key in array p_bucket_keys loop
    if length(coalesce(v_key, '')) < 32 or length(v_key) > 128 then
      raise exception 'invalid bucket key';
    end if;

    insert into public.api_rate_limits (
      bucket_key,
      policy,
      request_count,
      expires_at,
      updated_at
    )
    values (
      v_key,
      p_policy,
      1,
      v_new_expiry,
      v_now
    )
    on conflict (bucket_key) do update
    set
      policy = excluded.policy,
      request_count = case
        when public.api_rate_limits.expires_at <= v_now then 1
        else public.api_rate_limits.request_count + 1
      end,
      expires_at = case
        when public.api_rate_limits.expires_at <= v_now then v_new_expiry
        else public.api_rate_limits.expires_at
      end,
      updated_at = v_now
    returning
      request_count,
      expires_at
    into
      v_count,
      v_expiry;

    v_max_count := greatest(v_max_count, v_count);

    if v_earliest_expiry is null or v_expiry < v_earliest_expiry then
      v_earliest_expiry := v_expiry;
    end if;
  end loop;

  -- Lightweight opportunistic garbage collection. It is deliberately rare
  -- so normal API requests do not spend time deleting old buckets.
  if random() < 0.005 then
    delete from public.api_rate_limits
    where bucket_key in (
      select bucket_key
      from public.api_rate_limits
      where expires_at < v_now - interval '1 day'
      order by expires_at asc
      limit 500
    );
  end if;

  allowed := v_max_count <= p_limit;
  remaining := greatest(p_limit - v_max_count, 0);
  reset_at := coalesce(v_earliest_expiry, v_new_expiry);
  retry_after := greatest(
    1,
    ceil(extract(epoch from (reset_at - v_now)))::integer
  );

  return next;
end;
$$;

revoke all on function public.consume_api_rate_limits(text[], text, integer, integer) from public;
revoke all on function public.consume_api_rate_limits(text[], text, integer, integer) from anon;
revoke all on function public.consume_api_rate_limits(text[], text, integer, integer) from authenticated;
grant execute on function public.consume_api_rate_limits(text[], text, integer, integer) to service_role;

comment on table public.api_rate_limits is
  'BRASIVO distributed API rate-limit buckets. Keys are HMAC digests; raw IP addresses are not stored.';
