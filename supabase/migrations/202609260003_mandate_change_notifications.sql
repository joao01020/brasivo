create extension if not exists pgcrypto;

create table if not exists public.mandate_source_events (
  id uuid primary key default gen_random_uuid(),
  representative_external_id text not null,
  representative_name text,
  source text not null default 'camara',
  kind text not null check (kind in ('expense','project','activity')),
  source_key text not null,
  fingerprint text not null,
  title text not null,
  message text,
  source_url text,
  occurred_at timestamptz,
  detected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (source, representative_external_id, kind, source_key)
);

create index if not exists idx_mandate_source_events_rep
  on public.mandate_source_events (representative_external_id, detected_at desc);

create table if not exists public.mandate_sync_state (
  representative_external_id text not null,
  source text not null default 'camara',
  kind text not null check (kind in ('expense','project','activity')),
  initialized_at timestamptz not null default now(),
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  primary key (representative_external_id, source, kind)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  message text,
  source_url text,
  occurred_at timestamptz,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.notifications
  add column if not exists event_id uuid,
  add column if not exists representative_external_id text,
  add column if not exists representative_name text,
  add column if not exists kind text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'notifications_user_event_unique') then
    alter table public.notifications
      add constraint notifications_user_event_unique unique (user_id, event_id);
  end if;
end $$;

create index if not exists idx_notifications_user_created on public.notifications (user_id, created_at desc);
create index if not exists idx_notifications_user_unread on public.notifications (user_id, created_at desc) where read_at is null;
create index if not exists idx_notifications_rep on public.notifications (representative_external_id, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications" on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.mandate_source_events enable row level security;
alter table public.mandate_sync_state enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
