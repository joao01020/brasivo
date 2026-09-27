-- BRASIVO V29 — balanced summary order
-- Pipeline version changes in application code.
-- Existing cache rows remain stored but are ignored by the new version.

create index if not exists mandate_summary_cache_pipeline_version_idx
  on public.mandate_summary_cache (pipeline_version);
