-- 0004: independent enable toggles for each 2FA method.
--
-- Until now profiles.mfa_method picked one method as "primary" and the other
-- was always available as fallback. The new model: each method is on/off
-- independently. The user must have at least one enabled. mfa_method now only
-- means "which to default to at login when BOTH are enabled".

alter table public.profiles
  add column if not exists email_2fa_enabled boolean not null default true;

-- Backfill: if a user had mfa_method='email' they obviously had email enabled
-- (default true above already covers that). If they had mfa_method='totp' as
-- primary, leave email enabled as well (the previous model gave it for free).
