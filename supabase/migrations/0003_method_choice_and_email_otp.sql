-- 0003: per-user 2FA method choice + email OTP challenge store
--
-- profiles.mfa_method records whether the user chose authenticator-app TOTP
-- (handled by Supabase MFA, factors live in auth.mfa_factors) or our own
-- email OTP flow (codes hashed and stored in public.email_otp_challenges,
-- session-level "passed" state tracked in a signed cookie).

alter table public.profiles
  add column if not exists mfa_method text
    not null default 'totp'
    check (mfa_method in ('totp', 'email'));

create table if not exists public.email_otp_challenges (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  code_hash    text not null,
  attempts     int  not null default 0,
  expires_at   timestamptz not null default (now() + interval '10 minutes'),
  consumed_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists email_otp_challenges_user_idx
  on public.email_otp_challenges(user_id);

alter table public.email_otp_challenges enable row level security;
-- server-only table: no policies → only service role bypass.
