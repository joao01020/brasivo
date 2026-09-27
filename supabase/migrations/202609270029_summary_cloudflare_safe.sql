-- BRASIVO V35 — Cloudflare-safe summary pipeline
--
-- No destructive schema changes.
-- Application pipeline:
-- progressive-summary-v35-cloudflare-safe
--
-- Changes are application-side:
-- - one activity period;
-- - one multi-year CEAP query;
-- - no parallel expense/attendance fanout;
-- - no release-lock subrequest after generation;
-- - old cache rows ignored via pipeline_version.

create index if not exists mandate_summary_cache_pipeline_version_idx
  on public.mandate_summary_cache (pipeline_version);
