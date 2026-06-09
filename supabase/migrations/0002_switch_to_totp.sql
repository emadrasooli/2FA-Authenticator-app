-- University 2FA Auth — switch from WebAuthn to Supabase MFA (TOTP)
--
-- The new flow uses Supabase's built-in MFA (factors stored in auth.mfa_factors)
-- and Supabase's session AAL2 promotion, so we no longer need our own
-- webauthn_* tables or custom auth_sessions cookie tracker.
--
-- Run this AFTER 0001_init.sql on the same project.

drop policy if exists webauthn_credentials_self on public.webauthn_credentials;
drop table if exists public.webauthn_credentials;

drop table if exists public.webauthn_challenges;

drop table if exists public.auth_sessions;
