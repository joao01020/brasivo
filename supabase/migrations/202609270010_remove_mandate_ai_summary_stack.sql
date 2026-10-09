-- ============================================================
-- BRASIVO — remover stack antiga de resumo com IA/cache
-- ============================================================

drop function if exists public.mark_mandate_ai_summary_dirty(bigint, text);
drop table if exists public.mandate_ai_summary_cache cascade;
drop table if exists public.mandate_ai_summary_queue cascade;
