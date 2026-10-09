-- BRASIVO V32 — progressive stream without visible overwrite
--
-- No destructive schema changes.
-- Application pipeline_version changes to:
-- progressive-summary-v32-stream-no-overwrite
--
-- Previous cache rows remain stored but are ignored by V32.

create index if not exists mandate_summary_cache_pipeline_version_idx
  on public.mandate_summary_cache (pipeline_version);
