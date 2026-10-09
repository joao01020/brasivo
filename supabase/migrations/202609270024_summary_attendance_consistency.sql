-- BRASIVO V30 — attendance consistency guard
-- No destructive schema changes.
-- Application pipeline_version changes to progressive-summary-v30-attendance-guard.
-- Older cached summaries remain stored but are not served by V30.

create index if not exists mandate_summary_cache_pipeline_version_idx
  on public.mandate_summary_cache (pipeline_version);
