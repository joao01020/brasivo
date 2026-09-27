-- BRASIVO V34 — natural balanced mandate narrative
--
-- No destructive schema changes.
-- Application pipeline:
-- progressive-summary-v34-natural-mandate-narrative
--
-- Previous cache rows remain stored but are ignored by V34.

create index if not exists mandate_summary_cache_pipeline_version_idx
  on public.mandate_summary_cache (pipeline_version);
