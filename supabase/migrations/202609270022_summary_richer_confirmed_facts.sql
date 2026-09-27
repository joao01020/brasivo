-- BRASIVO V28 — richer confirmed summary facts
-- No destructive schema change is required.
-- V28 uses a new pipeline_version and therefore ignores earlier cache rows.

create index if not exists mandate_summary_cache_pipeline_version_idx
  on public.mandate_summary_cache (pipeline_version);
