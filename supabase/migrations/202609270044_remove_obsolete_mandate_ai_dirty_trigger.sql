-- ============================================================
-- BRASIVO
-- Remove resíduos da stack antiga de invalidação de resumo IA.
--
-- A função mark_mandate_ai_summary_dirty() foi removida quando
-- a antiga stack de resumo/cache foi descontinuada, porém o
-- trigger de mandate_source_events e sua função intermediária
-- permaneceram no banco.
--
-- Isso fazia INSERTs em mandate_source_events falharem com
-- PostgreSQL 42883 ao tentar chamar a função já removida.
-- ============================================================

drop trigger if exists trigger_mandate_source_event_ai_dirty
  on public.mandate_source_events;

drop function if exists public.on_mandate_source_event_mark_ai_dirty();

-- Segurança adicional para bancos que ainda possuam algum
-- resíduo da função antiga.
drop function if exists public.mark_mandate_ai_summary_dirty(bigint, text);
