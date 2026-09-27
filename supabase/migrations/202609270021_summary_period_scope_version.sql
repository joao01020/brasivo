-- BRASIVO V27 — summary period consistency / cache versioning

alter table if exists public.mandate_summary_cache
  add column if not exists pipeline_version text;

create index if not exists mandate_summary_cache_pipeline_version_idx
  on public.mandate_summary_cache (pipeline_version);

-- Old cache rows are intentionally kept for audit/debugging,
-- but V27 ignores rows whose pipeline_version is not the current one.
