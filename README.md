# University 2FA Authenticator

A free-tier-only web app implementing **invite-only sign-up** and **two-factor sign-in** for a university portal:

- **Factor 1**: email + password (Supabase Auth)
- **Factor 2**: device biometric **passkey** (WebAuthn — Touch ID, Windows Hello, Android fingerprint)

Roles: `admin`, `teacher`, `student` — each gets a role-specific dashboard.

## Stack

- Next.js 15 (App Router) + TypeScript
- Supabase (Postgres + Auth + RLS) — free tier
- `@simplewebauthn/server` + `@simplewebauthn/browser` for passkeys
- Tailwind CSS for styling
- Deploys to Vercel Hobby (free)

Everything in this app is free to run.

## 1. Create a Supabase project

1. Sign up at <https://supabase.com> and create a new project (Free tier).
2. In the SQL editor, run `supabase/migrations/0001_init.sql`.
3. In **Project Settings → API**, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only!)

### Seed the first admin

Supabase needs an `auth.users` row plus a matching `public.profiles` row.

Easiest path:

1. **Authentication → Users → Add user** in the Supabase dashboard. Set email + password, mark "Auto Confirm User".
2. In SQL editor:
   ```sql
   insert into public.profiles (id, full_name, email, role)
   values ('<copied-user-uuid>', 'Site Admin', 'admin@example.edu', 'admin');
   ```
3. You can now sign in at `/login` as the admin. Because there is no passkey yet, you will be redirected to `/onboarding/passkey` to register one.

## 2. Configure local env

```bash
cp .env.example .env.local
# fill in Supabase keys; leave RP_ID=localhost and RP_ORIGIN=http://localhost:3000 for dev
```

## 3. Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## 4. End-to-end flow

1. Sign in as the seeded admin → register a passkey → land on `/dashboard/admin`.
2. Go to **Invitations** → create an invite for a teacher or student.
3. Copy the invite link, open it in an incognito window → set name + password → register a passkey → land on the correct role dashboard.
4. Sign out, sign back in: password → biometric → dashboard.

## 5. Deploy to Vercel

1. Push this repo to GitHub.
2. On Vercel → **Add New Project** → import the repo.
3. Set environment variables (production):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_RP_ID` = your domain (e.g. `myapp.vercel.app`, **no protocol**)
   - `NEXT_PUBLIC_RP_ORIGIN` = `https://myapp.vercel.app`
   - `NEXT_PUBLIC_APP_URL` = `https://myapp.vercel.app`
4. Deploy. Passkeys you registered on `localhost` will **not** work on the production domain — register a new one there.

## Project layout

```
src/
  app/
    (auth)/login                       # email + password
    (auth)/login/passkey               # WebAuthn assertion step
    (auth)/signup                      # invite-token signup
    (auth)/onboarding/passkey          # first-time passkey registration
    (dashboard)/dashboard/{admin,teacher,student}
    (dashboard)/dashboard/admin/invitations
    api/webauthn/register/{options,verify}
    api/webauthn/authenticate/{options,verify}
    api/auth/signout
  lib/
    supabase/{client,server,admin,middleware}.ts
    auth/{session,rbac}.ts
    webauthn.ts                        # SimpleWebAuthn wrappers
    env.ts
  components/ui/                       # button, input, card, label
  middleware.ts                        # session refresh + guard
supabase/migrations/0001_init.sql      # tables, RLS, helpers
```

## Security model

- **RLS on every table.** Users can only read their own `profiles` and `webauthn_credentials`. Admins can read all profiles and manage invitations. `webauthn_challenges` and `auth_sessions` have **no** policies — they are server-only (service role).
- The `SUPABASE_SERVICE_ROLE_KEY` is imported only in `src/lib/supabase/admin.ts`, which starts with `import "server-only"` so Next will refuse to bundle it into the client.
- After password sign-in we set an `aal2_session` cookie tied to a server row in `auth_sessions`. The cookie alone is not enough; the row's `aal2_passkey` flag must be `true`. We flip it to `true` only after a verified WebAuthn assertion.
- WebAuthn challenges are single-use and expire in 5 minutes.
- `requireRole('admin')` etc. re-checks the role server-side on every render — never trust the client.

## What's not built (v1)

Courses / assignments / grades, email-OTP recovery UI, multi-passkey management UI, audit log, SSO. The auth foundation is the focus — these are easy to layer on top.
