-- BRASIVO V21 — contadores públicos agregados de acompanhamento.
-- Expõe somente totais; nunca user_id ou identidade de quem acompanha.

create or replace function public.get_mandate_follow_count(
  p_source text,
  p_external_id text
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.representative_follows
  where representative_source = p_source
    and representative_external_id = p_external_id;
$$;

create or replace function public.get_mandate_follow_counts(
  p_source text,
  p_external_ids text[]
)
returns table(external_id text, follower_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select requested.external_id,
         count(f.user_id)::bigint as follower_count
  from unnest(p_external_ids) as requested(external_id)
  left join public.representative_follows f
    on f.representative_source = p_source
   and f.representative_external_id = requested.external_id
  group by requested.external_id;
$$;

revoke all on function public.get_mandate_follow_count(text, text) from public;
revoke all on function public.get_mandate_follow_counts(text, text[]) from public;
grant execute on function public.get_mandate_follow_count(text, text) to anon, authenticated;
grant execute on function public.get_mandate_follow_counts(text, text[]) to anon, authenticated;
