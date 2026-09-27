-- BRASIVO security hardening:
-- If a user has at least one verified MFA factor, profile UPDATE requires AAL2.
-- Users without MFA continue to work with AAL1 or AAL2.
--
-- Restrictive policy intentionally supplements existing ownership/update
-- policies instead of replacing them.

alter table public.profiles enable row level security;

drop policy if exists "brasivo_profiles_require_aal2_when_mfa_enabled"
on public.profiles;

create policy "brasivo_profiles_require_aal2_when_mfa_enabled"
on public.profiles
as restrictive
for update
to authenticated
using (
  array[(select auth.jwt()->>'aal')] <@ (
    select
      case
        when count(id) > 0 then array['aal2']
        else array['aal1', 'aal2']
      end
    from auth.mfa_factors
    where (select auth.uid()) = user_id
      and status = 'verified'
  )
)
with check (
  array[(select auth.jwt()->>'aal')] <@ (
    select
      case
        when count(id) > 0 then array['aal2']
        else array['aal1', 'aal2']
      end
    from auth.mfa_factors
    where (select auth.uid()) = user_id
      and status = 'verified'
  )
);

comment on policy "brasivo_profiles_require_aal2_when_mfa_enabled"
on public.profiles is
'Restrictive MFA policy: users who opted into MFA must present an aal2 JWT to update their profile.';
