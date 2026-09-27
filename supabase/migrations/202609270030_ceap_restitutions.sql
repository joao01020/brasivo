-- BRASIVO V36 — CEAP restitutions from official Câmara annual files
--
-- Official source fields:
--   ideCadastro
--   ideDocumento
--   vlrRestituicao
--   datPagamentoRestituicao
--
-- We keep restitutions in a separate table so:
-- - the original ceap_expenses table remains untouched;
-- - multiple official records tied to the same document are preserved;
-- - absence never becomes "não devolveu";
-- - only explicitly recorded restitutions are shown.

create table if not exists public.ceap_restitutions (
  id uuid primary key default gen_random_uuid(),

  representative_source text not null default 'camara',
  representative_external_id text not null,

  year integer not null check (year >= 2008),
  official_document_id text,

  restitution_value numeric(16,2) not null check (restitution_value > 0),
  restitution_paid_at timestamptz,

  document_number text,
  category text,
  supplier text,

  source_url text not null,
  source_row_key text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (source_row_key)
);

create index if not exists idx_ceap_restitutions_rep_year
  on public.ceap_restitutions (
    representative_source,
    representative_external_id,
    year
  );

create index if not exists idx_ceap_restitutions_paid_at
  on public.ceap_restitutions (
    representative_external_id,
    restitution_paid_at desc
  );

alter table public.ceap_restitutions enable row level security;

drop policy if exists "Public can read CEAP restitutions"
  on public.ceap_restitutions;

create policy "Public can read CEAP restitutions"
on public.ceap_restitutions
for select
to anon, authenticated
using (true);

create or replace function public.set_ceap_restitutions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ceap_restitutions_updated_at
  on public.ceap_restitutions;

create trigger trg_ceap_restitutions_updated_at
before update
on public.ceap_restitutions
for each row
execute function public.set_ceap_restitutions_updated_at();
