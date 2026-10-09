-- ============================================================
-- BRASIVO — permitir leitura necessária para UPSERT do avatar
-- ============================================================

drop policy if exists "BRASIVO avatar select"
  on storage.objects;

create policy "BRASIVO avatar select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'profile-avatars'
  and name like auth.uid()::text || '/%'
);
