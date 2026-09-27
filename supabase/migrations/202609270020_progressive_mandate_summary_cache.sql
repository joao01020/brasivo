-- BRASIVO progressive summary cache v2
-- Dedicated cache for the progressive mandate summary.

create table if not exists public.mandate_summary_cache (
  mandate_id bigint primary key,
  summary text,
  digest jsonb not null default '{}'::jsonb,
  mode text check (mode in ('ai', 'factual')),
  model text,
  generated_at timestamptz,
  expires_at timestamptz,
  refreshing_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.mandate_summary_cache
  enable row level security;

-- No public policies are created.
-- Server-side service-role access bypasses RLS.

create index if not exists mandate_summary_cache_expires_idx
  on public.mandate_summary_cache (expires_at);

create or replace function public.claim_mandate_summary_refresh(
  p_mandate_id bigint,
  p_lease_seconds integer default 45
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  insert into public.mandate_summary_cache (
    mandate_id,
    refreshing_until,
    updated_at
  )
  values (
    p_mandate_id,
    now() + make_interval(secs => greatest(5, least(p_lease_seconds, 120))),
    now()
  )
  on conflict (mandate_id)
  do update
    set
      refreshing_until = excluded.refreshing_until,
      updated_at = now()
    where
      public.mandate_summary_cache.refreshing_until is null
      or public.mandate_summary_cache.refreshing_until < now();

  get diagnostics v_rows = row_count;

  return v_rows > 0;
end;
$$;

revoke all on function public.claim_mandate_summary_refresh(bigint, integer)
  from public;

grant execute on function public.claim_mandate_summary_refresh(bigint, integer)
  to service_role;

-- Clean only the obsolete mandate-summary stack, if it still exists.
drop function if exists public.mark_mandate_ai_summary_dirty(bigint, text);
drop function if exists public.claim_mandate_ai_summary_generation(bigint, text);
drop table if exists public.mandate_ai_summary_state cascade;
drop table if exists public.mandate_ai_summary_cache cascade;
