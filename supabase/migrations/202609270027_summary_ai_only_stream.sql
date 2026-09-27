-- BRASIVO V33 — AI-only visible stream
-- No destructive schema changes.
-- New pipeline version: progressive-summary-v33-ai-only-stream
-- Earlier cache rows remain stored but are ignored.

create index if not exists mandate_summary_cache_pipeline_version_idx
  on public.mandate_summary_cache (pipeline_version);
