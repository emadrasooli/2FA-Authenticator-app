-- 0005: Passkey / Windows Hello as a third 2FA method
--
-- Adds WebAuthn credential storage and a short-lived challenge table.
-- Both are server-only (no RLS policies → service role only).
-- mfa_method gains 'passkey' as a valid "default at login" value.

alter table public.profiles drop constraint if exists profiles_mfa_method_check;
alter table public.profiles
  add constraint profiles_mfa_method_check
  check (mfa_method in ('totp', 'email', 'passkey'));

create table if not exists public.webauthn_credentials (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  credential_id   text not null unique,
  public_key      text not null,
  counter         bigint not null default 0,
  transports      text[] not null default '{}',
  device_name     text,
  created_at      timestamptz not null default now(),
  last_used_at    timestamptz
);

create index if not exists webauthn_credentials_user_idx
  on public.webauthn_credentials(user_id);

create table if not exists public.webauthn_challenges (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  challenge    text not null,
  purpose      text not null check (purpose in ('register', 'authenticate')),
  expires_at   timestamptz not null default (now() + interval '5 minutes'),
  consumed_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists webauthn_challenges_user_idx
  on public.webauthn_challenges(user_id);

alter table public.webauthn_credentials enable row level security;
alter table public.webauthn_challenges  enable row level security;
-- No policies: only the service role can read/write these tables.
