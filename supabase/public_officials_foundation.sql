-- BRASIVO V19 — fundação genérica para futuras fontes estaduais e municipais.
-- Não substitui representative_follows nesta versão; permite migração gradual sem quebrar o fluxo atual.

create table if not exists public.municipalities (
  ibge_code text primary key,
  name text not null,
  state char(2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists municipalities_state_name_idx on public.municipalities (state, name);

create table if not exists public.public_officials (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text not null,
  name text not null,
  photo_url text,
  party text,
  office text not null check (office in (
    'president','vice_president','senator','federal_deputy','governor','vice_governor',
    'state_deputy','district_deputy','mayor','vice_mayor','councillor'
  )),
  government_level text not null check (government_level in ('federal','state','municipal')),
  branch text not null check (branch in ('executive','legislative')),
  state char(2) not null,
  municipality_ibge_code text references public.municipalities(ibge_code) on delete set null,
  status text,
  source_url text not null,
  raw_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);

create index if not exists public_officials_state_idx on public.public_officials (state);
create index if not exists public_officials_municipality_idx on public.public_officials (municipality_ibge_code);
create index if not exists public_officials_office_idx on public.public_officials (office);

create table if not exists public.public_official_events (
  id uuid primary key default gen_random_uuid(),
  public_official_id uuid not null references public.public_officials(id) on delete cascade,
  source text not null,
  external_event_id text not null,
  event_type text not null,
  title text not null,
  description text,
  occurred_at timestamptz not null,
  source_url text not null,
  created_at timestamptz not null default now(),
  unique (source, external_event_id)
);

create index if not exists public_official_events_official_date_idx
  on public.public_official_events (public_official_id, occurred_at desc);

-- Catálogo público: somente leitura para clientes. Escrita fica reservada ao backend de ingestão.
alter table public.municipalities enable row level security;
alter table public.public_officials enable row level security;
alter table public.public_official_events enable row level security;

drop policy if exists "municipalities_public_read" on public.municipalities;
create policy "municipalities_public_read" on public.municipalities for select using (true);

drop policy if exists "public_officials_public_read" on public.public_officials;
create policy "public_officials_public_read" on public.public_officials for select using (true);

drop policy if exists "public_official_events_public_read" on public.public_official_events;
create policy "public_official_events_public_read" on public.public_official_events for select using (true);
