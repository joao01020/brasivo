-- BRASIVO V15 — acompanhamento de parlamentares.
create table if not exists public.representative_follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  representative_external_id text not null,
  representative_source text not null,
  representative_name text not null,
  representative_office text,
  representative_state text,
  created_at timestamptz not null default now(),
  constraint representative_follows_unique unique (user_id, representative_source, representative_external_id)
);
create index if not exists representative_follows_user_created_idx on public.representative_follows(user_id, created_at desc);
alter table public.representative_follows enable row level security;
drop policy if exists "representative_follows_select_own" on public.representative_follows;
create policy "representative_follows_select_own" on public.representative_follows for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "representative_follows_insert_own" on public.representative_follows;
create policy "representative_follows_insert_own" on public.representative_follows for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "representative_follows_delete_own" on public.representative_follows;
create policy "representative_follows_delete_own" on public.representative_follows for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, delete on public.representative_follows to authenticated;
