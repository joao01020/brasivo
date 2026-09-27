-- BRASIVO
-- Otimiza a consulta usada pelo monitoramento para localizar
-- seguidores de um parlamentar específico.
--
-- O índice existente em representative_follows começa por user_id
-- e atende a navegação por usuário. Este atende o caminho inverso:
-- representante -> seguidores.

create index if not exists representative_follows_rep_source_idx
  on public.representative_follows (
    representative_external_id,
    representative_source
  );

comment on index public.representative_follows_rep_source_idx is
  'Acelera a busca de seguidores por representante e fonte usada pelo monitoramento.';
