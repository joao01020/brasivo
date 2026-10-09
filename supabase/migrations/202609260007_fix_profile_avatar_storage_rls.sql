-- ============================================================
-- BRASIVO — PROFILE AVATAR STORAGE RLS
-- ============================================================

alter table public.profiles
  add column if not exists avatar_url text;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  3145728,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload own profile avatar"
  on storage.objects;

drop policy if exists "Users can update own profile avatar"
  on storage.objects;

drop policy if exists "Users can delete own profile avatar"
  on storage.objects;

drop policy if exists "BRASIVO avatar insert"
  on storage.objects;

drop policy if exists "BRASIVO avatar update"
  on storage.objects;

drop policy if exists "BRASIVO avatar delete"
  on storage.objects;

create policy "BRASIVO avatar insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-avatars'
  and name like auth.uid()::text || '/%'
);

create policy "BRASIVO avatar update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-avatars'
  and name like auth.uid()::text || '/%'
)
with check (
  bucket_id = 'profile-avatars'
  and name like auth.uid()::text || '/%'
);

create policy "BRASIVO avatar delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-avatars'
  and name like auth.uid()::text || '/%'
);
