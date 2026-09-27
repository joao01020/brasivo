-- BRASIVO V31 — single source / real confirmed data only
--
-- No destructive schema change.
-- V31 changes pipeline_version in application code.
-- Previous summary rows remain stored but are ignored by V31.

create index if not exists mandate_summary_cache_pipeline_version_idx
  on public.mandate_summary_cache (pipeline_version);
