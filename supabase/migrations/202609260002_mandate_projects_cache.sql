-- Cache opcional dos projetos exibidos na página de mandato.
-- A aplicação funciona sem esta migration; ela prepara persistência futura.

create table if not exists public.mandate_projects (
  id uuid primary key default gen_random_uuid(),
  representative_source text not null default 'camara',
  representative_external_id text not null,
  proposition_external_id bigint not null,
  proposition_type text not null,
  proposition_number integer,
  proposition_year integer not null,
  summary text,
  presented_at timestamptz,
  official_status text,
  simple_status text,
  status_kind text,
  source_url text not null,
  collected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (representative_source, representative_external_id, proposition_external_id)
);

create index if not exists mandate_projects_representative_year_idx
  on public.mandate_projects (representative_source, representative_external_id, proposition_year desc);

alter table public.mandate_projects enable row level security;

drop policy if exists "mandate_projects_public_read" on public.mandate_projects;
create policy "mandate_projects_public_read"
  on public.mandate_projects
  for select
  to anon, authenticated
  using (true);
