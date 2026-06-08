-- University 2FA Auth — initial schema
-- Run this in the Supabase SQL editor (or via supabase CLI) on a fresh project.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- =====================================================================
-- profiles: 1:1 with auth.users, carries role
-- =====================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       citext not null unique,
  role        text not null check (role in ('admin','teacher','student')),
  created_at  timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles(role);

-- =====================================================================
-- invitations: admin issues these, user signs up via single-use token
-- =====================================================================
create table if not exists public.invitations (
  id          uuid primary key default gen_random_uuid(),
  email       citext not null,
  role        text not null check (role in ('admin','teacher','student')),
  token       text not null unique,
  invited_by  uuid references auth.users(id) on delete set null,
  expires_at  timestamptz not null default (now() + interval '7 days'),
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists invitations_email_idx on public.invitations(email);
create index if not exists invitations_token_idx on public.invitations(token);

-- =====================================================================
-- webauthn_credentials: registered passkeys per user
-- =====================================================================
create table if not exists public.webauthn_credentials (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  credential_id   text not null unique,        -- base64url
  public_key      text not null,               -- base64url COSE key
  counter         bigint not null default 0,
  transports      text[] not null default '{}',
  device_name     text,
  created_at      timestamptz not null default now(),
  last_used_at    timestamptz
);

create index if not exists webauthn_credentials_user_idx on public.webauthn_credentials(user_id);

-- =====================================================================
-- webauthn_challenges: short-lived nonces for register/auth ceremonies
-- =====================================================================
create table if not exists public.webauthn_challenges (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  email       citext,                          -- used when no user yet (pre-auth)
  challenge   text not null,
  type        text not null check (type in ('register','authenticate')),
  expires_at  timestamptz not null default (now() + interval '5 minutes'),
  created_at  timestamptz not null default now()
);

create index if not exists webauthn_challenges_user_idx on public.webauthn_challenges(user_id);
create index if not exists webauthn_challenges_email_idx on public.webauthn_challenges(email);

-- =====================================================================
-- auth_sessions: tracks whether the current session has passed passkey 2FA
-- =====================================================================
create table if not exists public.auth_sessions (
  session_id     text primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  aal2_passkey   boolean not null default false,
  expires_at     timestamptz not null default (now() + interval '12 hours'),
  created_at     timestamptz not null default now()
);

create index if not exists auth_sessions_user_idx on public.auth_sessions(user_id);

-- =====================================================================
-- Helper: current user's role
-- =====================================================================
create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles              enable row level security;
alter table public.invitations           enable row level security;
alter table public.webauthn_credentials  enable row level security;
alter table public.webauthn_challenges   enable row level security;
alter table public.auth_sessions         enable row level security;

-- profiles: a user reads/updates self; admins read all
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (auth.uid() = id or public.current_role_name() = 'admin');

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (auth.uid() = id);

-- invitations: only admins
drop policy if exists invitations_admin_all on public.invitations;
create policy invitations_admin_all on public.invitations
  for all using (public.current_role_name() = 'admin')
  with check (public.current_role_name() = 'admin');

-- webauthn_credentials: a user manages only their own
drop policy if exists webauthn_credentials_self on public.webauthn_credentials;
create policy webauthn_credentials_self on public.webauthn_credentials
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- webauthn_challenges + auth_sessions: server-only (service role bypasses RLS)
-- We deliberately add NO policies → no anon/authenticated access.

-- =====================================================================
-- Seed: first admin (edit the email/name before running, or insert later)
-- The matching auth.users row must already exist (sign up via SQL or dashboard).
-- =====================================================================
-- insert into public.profiles (id, full_name, email, role)
-- values ('<auth-user-uuid>', 'Site Admin', 'admin@example.edu', 'admin');
