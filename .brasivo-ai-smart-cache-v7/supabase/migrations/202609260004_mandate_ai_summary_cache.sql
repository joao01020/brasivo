-- ============================================================
-- BRASIVO — AI SMART CACHE V7
-- Cache persistente por fingerprint + dirty state + lease
-- ============================================================

create table if not exists public.mandate_ai_summary_cache (
  mandate_id bigint not null,
  source_fingerprint text not null,
  prompt_version text not null,
  model text not null,
  status text not null default 'generating',
  mode text,
  summary jsonb,
  generated_at timestamptz,
  expires_at timestamptz,
  lease_until timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint mandate_ai_summary_cache_status_check
    check (status in ('generating', 'ready', 'failed')),

  constraint mandate_ai_summary_cache_mode_check
    check (mode is null or mode in ('ai', 'automatic')),

  constraint mandate_ai_summary_cache_pkey
    primary key (
      mandate_id,
      source_fingerprint,
      prompt_version,
      model
    )
);

create index if not exists mandate_ai_summary_cache_latest_idx
  on public.mandate_ai_summary_cache
  (mandate_id, generated_at desc nulls last, updated_at desc);

create index if not exists mandate_ai_summary_cache_status_idx
  on public.mandate_ai_summary_cache
  (status, lease_until);

create table if not exists public.mandate_ai_summary_state (
  mandate_id bigint primary key,
  dirty boolean not null default true,
  dirty_reason text,
  last_fingerprint text,
  last_source_check_at timestamptz,
  last_generation_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists mandate_ai_summary_state_dirty_idx
  on public.mandate_ai_summary_state (dirty, updated_at);

alter table public.mandate_ai_summary_cache enable row level security;
alter table public.mandate_ai_summary_state enable row level security;

-- Sem policies públicas: somente service_role no backend.

create or replace function public.claim_mandate_ai_summary_generation(
  p_mandate_id bigint,
  p_source_fingerprint text,
  p_prompt_version text,
  p_model text,
  p_lease_seconds integer default 120
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed boolean := false;
begin
  insert into public.mandate_ai_summary_cache (
    mandate_id,
    source_fingerprint,
    prompt_version,
    model,
    status,
    lease_until,
    created_at,
    updated_at
  )
  values (
    p_mandate_id,
    p_source_fingerprint,
    p_prompt_version,
    p_model,
    'generating',
    now() + make_interval(secs => greatest(30, p_lease_seconds)),
    now(),
    now()
  )
  on conflict (
    mandate_id,
    source_fingerprint,
    prompt_version,
    model
  )
  do update
  set
    status = 'generating',
    lease_until = now() + make_interval(secs => greatest(30, p_lease_seconds)),
    error = null,
    updated_at = now()
  where
    mandate_ai_summary_cache.status = 'failed'
    or (
      mandate_ai_summary_cache.status = 'generating'
      and coalesce(
        mandate_ai_summary_cache.lease_until,
        '-infinity'::timestamptz
      ) < now()
    )
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

revoke all on function public.claim_mandate_ai_summary_generation(
  bigint, text, text, text, integer
) from public;

grant execute on function public.claim_mandate_ai_summary_generation(
  bigint, text, text, text, integer
) to service_role;

create or replace function public.mark_mandate_ai_summary_dirty(
  p_mandate_id bigint,
  p_reason text default 'source_change'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.mandate_ai_summary_state (
    mandate_id,
    dirty,
    dirty_reason,
    updated_at
  )
  values (
    p_mandate_id,
    true,
    nullif(trim(p_reason), ''),
    now()
  )
  on conflict (mandate_id)
  do update
  set
    dirty = true,
    dirty_reason = excluded.dirty_reason,
    updated_at = now();
end;
$$;

revoke all on function public.mark_mandate_ai_summary_dirty(bigint, text)
from public;

grant execute on function public.mark_mandate_ai_summary_dirty(bigint, text)
to service_role;

create or replace function public.on_mandate_source_event_mark_ai_dirty()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_external_id text;
begin
  v_external_id := new.representative_external_id::text;

  if v_external_id ~ '^[0-9]+$' then
    perform public.mark_mandate_ai_summary_dirty(
      v_external_id::bigint,
      'mandate_source_event'
    );
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.mandate_source_events') is not null then
    execute 'drop trigger if exists trigger_mandate_source_event_ai_dirty on public.mandate_source_events';

    execute '
      create trigger trigger_mandate_source_event_ai_dirty
      after insert
      on public.mandate_source_events
      for each row
      execute function public.on_mandate_source_event_mark_ai_dirty()
    ';
  end if;
end;
$$;

comment on table public.mandate_ai_summary_cache is
'Cache persistente dos resumos de mandato do BRASIVO, identificado pelo fingerprint factual dos dados de origem.';

comment on table public.mandate_ai_summary_state is
'Estado de invalidação/frescura do resumo de IA por mandato.';
