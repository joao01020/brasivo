-- BRASIVO V36.1 — restitution enrichment is optional
--
-- No schema change is required by this hotfix.
-- The actual restitution table is still created by:
--   202609270030_ceap_restitutions.sql
--
-- V36.1 changes application behavior so missing restitution infrastructure
-- never breaks the normal CEAP expenses endpoint.
--
-- Keep this migration as a deployment marker.

select 1;
