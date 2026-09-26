-- BRASIVO
-- Cache/persistência opcional para sincronização futura.
-- A feature funciona imediatamente via API oficial mesmo sem esta migration.
-- Quando o job periódico for adicionado, esta estrutura evita recalcular todo
-- o histórico em cada abertura da página.

create table if not exists public.mandate_activities (
  id uuid primary key default gen_random_uuid(),
  representative_external_id text not null,
  representative_source text not null default 'camara',
  activity_type text not null
    check (activity_type in ('vote','event','speech','proposition')),
  title text not null,
  description text,
  occurred_at timestamptz not null,
  source text not null,
  source_id text,
  source_url text,
  metadata jsonb not null default '{}'::jsonb,
  collected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (representative_source, representative_external_id, activity_type, source_id)
);

create index if not exists mandate_activities_rep_date_idx
  on public.mandate_activities
  (representative_source, representative_external_id, occurred_at desc);

create table if not exists public.mandate_attendance_stats (
  id uuid primary key default gen_random_uuid(),
  representative_external_id text not null,
  representative_source text not null default 'camara',
  period_start date not null,
  period_end date not null,
  scope text not null check (scope in ('plenary')),
  total_considered integer not null default 0 check (total_considered >= 0),
  present_count integer not null default 0 check (present_count >= 0),
  absent_count integer not null default 0 check (absent_count >= 0),
  attendance_rate numeric(5,2),
  methodology text not null,
  source text not null,
  source_url text,
  calculated_at timestamptz not null default now(),
  unique (
    representative_source,
    representative_external_id,
    period_start,
    period_end,
    scope
  )
);

alter table public.mandate_activities enable row level security;
alter table public.mandate_attendance_stats enable row level security;

drop policy if exists "Public read mandate activities" on public.mandate_activities;
create policy "Public read mandate activities"
on public.mandate_activities
for select
to anon, authenticated
using (true);

drop policy if exists "Public read attendance stats" on public.mandate_attendance_stats;
create policy "Public read attendance stats"
on public.mandate_attendance_stats
for select
to anon, authenticated
using (true);

-- INSERT/UPDATE/DELETE devem permanecer restritos ao backend/service role.
