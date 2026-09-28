-- BRASIVO
-- Remove notificações históricas criadas para fatos anteriores ao momento
-- em que o usuário começou a acompanhar o parlamentar.
--
-- A regra de criação também é reforçada na aplicação. Esta migration limpa
-- somente notificações incompatíveis com o vínculo de acompanhamento atual;
-- os eventos oficiais em mandate_source_events são preservados.

delete from public.notifications as n
using public.representative_follows as f
where n.user_id = f.user_id
  and n.representative_external_id = f.representative_external_id
  and f.representative_source = 'camara'
  and (
    n.created_at < f.created_at
    or (
      coalesce(n.metadata ->> 'change', 'new') = 'new'
      and n.occurred_at is not null
      and n.occurred_at < f.created_at
    )
  );

comment on table public.notifications is
  'Notificações do usuário sobre alterações detectadas após o início do acompanhamento do mandato.';
