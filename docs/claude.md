# University 2FA Authenticator — Project Reference

> **Purpose.** A single, paste-able reference so any AI assistant (or new
> developer) can get fully up to speed without reading every file. Paste the
> whole thing as context. If anything here disagrees with the code, the code
> wins — update this file in the same change.

---

## 1. What this project is

An **invite-only** sign-in / sign-up web app for a university portal. Users
have one of three roles — `admin`, `teacher`, `student` — and land on a
role-specific dashboard after clearing two-factor authentication.

**Three independent second-factor methods**, each toggled on/off per user:

1. **Authenticator app (TOTP)** — Google Authenticator, Authy, 1Password, etc.
   Backed by **Supabase's built-in MFA** (`auth.mfa_factors`, `supabase.auth.mfa.*`).
2. **Email code** — a 6-digit code emailed via **Resend** each sign-in. Hashed
   (SHA-256) in `public.email_otp_challenges`; success sets a signed cookie.
3. **Passkey / fingerprint (WebAuthn)** — Windows Hello, Touch ID, Android
   biometric, or a USB security key. Built on `@simplewebauthn/*`. Credentials
   in `public.webauthn_credentials`; success sets a signed cookie.

Rules: a user must keep **at least one** method enabled. `profiles.mfa_method`
is the **default** shown first at login when more than one is enabled.

Password reset (separate from 2FA) is handled via Supabase's email recovery
link. There's no dedicated "lost 2FA" wipe flow — the other enabled method(s)
serve as the fallback, and methods are managed from Settings.

---

## 2. Stack

| Concern | Choice |
|---|---|
| Framework | **Next.js 16** (App Router, Turbopack default) + TypeScript, React 19.2 |
| Backend | All in-app: Server Actions + Route Handlers |
| Auth/DB | **Supabase** (Postgres + Auth + MFA + RLS) — free tier |
| Email | **Resend** free tier (invites + email-OTP). Also wired as Supabase's custom SMTP so Supabase-native emails (password reset, magic links) go through Resend too. |
| WebAuthn | `@simplewebauthn/server` + `@simplewebauthn/browser` |
| UI | Tailwind CSS (CSS-variable tokens, dark mode), hand-rolled `components/ui`, Inter font, `next-themes` |
| Hosting | **Vercel Hobby** (free) |

Everything targets a $0 running cost.

---

## 3. Repository layout

```
src/
  app/
    layout.tsx                                 # Inter font + ThemeProvider
    page.tsx                                   # public landing
    (auth)/
      login/                                   # email + password  (dispatches by config)
      login/choose/                            # pick a method when 2+ enabled
      login/totp/                              # authenticator code
      login/email/                             # email code (issues on render)
      login/passkey/                           # WebAuthn assertion
      signup/                                  # invite-token signup
      onboarding/method/                       # first choice of default method
      onboarding/totp/                         # first TOTP enrollment
      forgot-password/ , forgot-password?..    # request password reset
      reset-password/                          # set new password (recovery session)
    (dashboard)/
      layout.tsx                               # header: ProfileMenu + ThemeToggle
      dashboard/{admin,teacher,student}/
      dashboard/admin/invitations/
      dashboard/settings/                      # manage the 3 methods + default
      dashboard/settings/authenticator/        # enroll TOTP
      dashboard/settings/passkey/              # enroll passkey
    api/
      auth/signout/
      webauthn/{register-options,register-verify,auth-options,auth-verify}/
    auth/callback/                             # exchanges Supabase recovery code
  lib/
    env.ts                                     # strict env loader; derives WebAuthn RP_* from APP_URL
    utils.ts                                   # cn()
    email.ts                                   # Resend sender + invite template
    supabase/{client,server,admin,middleware}.ts
    auth/
      rbac.ts                                  # loadGate + requireMfaGate/requireFullyAuthed/requireRole
      aal-cookie.ts                            # unified signed AAL2 cookie (email | passkey)
      email-otp.ts                             # 6-digit email code issue/verify
      webauthn.ts                              # WebAuthn options/verify + credential I/O
  components/
    ProfileMenu.tsx  ThemeProvider.tsx  ThemeToggle.tsx
    ui/{button,card,input,label,password-input}.tsx
  proxy.ts                                     # Next 16 "proxy" convention (was middleware.ts): session refresh + public-path guard
supabase/migrations/
  0001_init.sql                                # profiles, invitations, RLS (+ legacy webauthn tables)
  0002_switch_to_totp.sql                      # drops the original passkey/auth_sessions tables
  0003_method_choice_and_email_otp.sql         # profiles.mfa_method + email_otp_challenges
  0004_independent_2fa_toggles.sql             # profiles.email_2fa_enabled
  0005_passkey_2fa.sql                         # webauthn_credentials + webauthn_challenges, mfa_method += 'passkey'
docs/claude.md                                 # this file
.env.example
```

> **Note on the migration history:** `0001` originally created WebAuthn tables
> for a first-attempt passkey design; `0002` dropped them when the app switched
> to TOTP. `0005` re-introduces WebAuthn with a different schema. Run all five in
> order on a fresh project.

---

## 4. Database schema (all RLS-enabled)

- **`public.profiles`** (1:1 with `auth.users`)
  - `id uuid PK`, `full_name`, `email citext unique`
  - `role text check ('admin'|'teacher'|'student')`
  - `mfa_method text check ('totp'|'email'|'passkey')` — the *default* at login
  - `email_2fa_enabled boolean default true`
  - Policies: self-read (or admin), self-update.
- **`public.invitations`** — single-use, 7-day tokens. Admin-only policy.
- **`public.email_otp_challenges`** — `code_hash` (SHA-256), `attempts`,
  `expires_at`, `consumed_at`. **Server-only** (RLS on, no policies).
- **`public.webauthn_credentials`** — `credential_id`, `public_key` (base64),
  `counter`, `transports`, `device_name`. **Server-only.**
- **`public.webauthn_challenges`** — `challenge`, `purpose ('register'|'authenticate')`,
  `expires_at`, `consumed_at`. **Server-only.**

"Enabled" is derived, not just a flag:
- TOTP enabled ⇔ a verified factor exists in `auth.mfa_factors`.
- Passkey enabled ⇔ ≥1 row in `webauthn_credentials`.
- Email enabled ⇔ `profiles.email_2fa_enabled = true`.

---

## 5. Auth model & routing

### The gate (`src/lib/auth/rbac.ts`)

`loadGate()` does a **single pass** — one `getUser()` (a network round-trip to
Supabase), one profile query, one `listFactors()`, one AAL check — and returns
`{ user, config, passed, totpFactor }`:

- `config`: `{ totpEnabled, emailEnabled, passkeyEnabled, preferred }`.
- `passed`: true iff the session cleared 2FA via a **currently-enabled** method:
  - TOTP → Supabase `aal.currentLevel === 'aal2'`, OR
  - email → valid `email_2fa` cookie, OR
  - passkey → valid `passkey_2fa` cookie.
  A signal from a method the user has since disabled does **not** count.

Public helpers:
- `requireMfaGate()` — used by the login challenge pages; returns the gate or
  redirects to `/login`.
- `requireFullyAuthed()` — returns the `SessionUser` if `passed`, else redirects
  to the right challenge via `chooseDispatch()`.
- `requireRole(role)` — `requireFullyAuthed` + role check (wrong role → user's
  own dashboard).
- `getMfaConfig()` — config only, for the settings screens.
- `loginRedirectFor(config)` — used by the login action.

`chooseDispatch(config)`: 0 enabled → `/onboarding/method`; 2+ enabled →
`/login/choose`; exactly one → that method's page.

### AAL2 cookies (`src/lib/auth/aal-cookie.ts`)

One parameterized module for the email and passkey methods (TOTP uses Supabase
AAL). Cookie value: `<userId>.<expiryMs>.<nonce>.<hmac>`, HMAC-SHA-256 keyed by
`SUPABASE_SERVICE_ROLE_KEY`, verified with `timingSafeEqual`, 12-hour TTL,
HttpOnly. API: `issueAal2Cookie(method, userId)`, `verifyAal2Cookie(method, userId)`,
`clearAal2Cookie(method)` where `method` is `'email' | 'passkey'`.

### Flows

- **Signup**: admin creates an invite (`invitations`, emailed via Resend) →
  `/signup?token=…` → set name+password → `/onboarding/method` → pick default →
  TOTP enrolls at `/onboarding/totp`; email is on by default → dashboard.
- **Login**: `/login` (password) → `loginAction` computes the enabled set and
  redirects (`/login/choose` | `/login/totp` | `/login/email` | `/login/passkey`).
  Each challenge page verifies and, on success, promotes AAL2 (Supabase for
  TOTP; a signed cookie for email/passkey) then → dashboard.
- **Password reset**: `/forgot-password` → Supabase `resetPasswordForEmail`
  with `redirectTo=/auth/callback?next=/reset-password` → the callback exchanges
  the code for a session → `/reset-password` sets the new password, signs out,
  clears both AAL cookies → `/login?reset=ok`.
- **Sign out**: `POST /api/auth/signout` clears both AAL cookies first, then
  Supabase `signOut`. `ProfileMenu` calls it, then a local client signOut. A
  confirmation dialog gates the action.

### Settings (`/dashboard/settings`, all roles)

Three cards — Passkey, Authenticator, Email — each with enable/disable (or
enroll/remove). Enabling TOTP/passkey routes to the enroll page (with
`?primary=1` when chosen as the default). A "Default at sign-in" picker appears
when ≥2 methods are enabled. Every mutation enforces "keep at least one method"
and, if the removed method was the default, moves `mfa_method` to another
enabled one; disabling email or removing passkey also clears that AAL cookie.

---

## 6. Environment variables

| name | required | purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase **anon** JWT (Legacy API Keys tab) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Supabase **service_role** JWT. Server-only. Also the HMAC key for AAL2 cookies. |
| `NEXT_PUBLIC_APP_URL` | yes | Public origin, e.g. `http://localhost:3000` |
| `RESEND_API_KEY` | optional | If unset, invites/email-OTP are disabled (invite link shown in UI with a warning). |
| `RESEND_FROM` | optional | Sender. `onboarding@resend.dev` in dev (delivers only to your Resend-account email); a verified domain in prod. |
| `NEXT_PUBLIC_RP_ID` / `_NAME` / `_ORIGIN` | optional | WebAuthn relying-party. **Auto-derived** from `APP_URL` (`RP_ID` = hostname, `RP_ORIGIN` = APP_URL) — only override for unusual hosting. |

`src/lib/env.ts` throws at import if a required var is missing. The service-role
key is imported only in `supabase/admin.ts` and `aal-cookie.ts` (both
`server-only`).

---

## 7. Setup (fresh)

1. `npm install`.
2. Create a Supabase project (pick a reachable region — avoid ones your network
   blocks). Run migrations `0001` → `0005` in order in the SQL editor.
3. `cp .env.example .env.local`; fill Supabase keys (Legacy anon + service_role).
4. (Optional) Resend key + `RESEND_FROM`. For arbitrary recipients, verify a
   domain; for Supabase-native emails, also set Resend as custom SMTP under
   Authentication → Emails → SMTP Settings (host `smtp.resend.com`, port 465,
   user `resend`, password = API key).
5. Supabase → Authentication → URL Configuration: add
   `http://localhost:3000/auth/callback` to Redirect URLs.
6. Supabase → Authentication → Emails → Templates → **Magic Link**: set the body
   to contain `{{ .Token }}` (the app's email-OTP flows want a code, not a link).
7. Seed the first admin: create the user (Authentication → Users, Auto Confirm),
   then
   `insert into public.profiles (id, full_name, email, role) select id, 'Site Admin', email, 'admin' from auth.users where email = '<you>' on conflict (id) do nothing;`
8. Dev: `npm run dev`. Fast local production: `npm run build && npm run start`.
9. Deploy: import on Vercel, set the env vars (production `APP_URL`), and add the
   prod `/auth/callback` to Supabase Redirect URLs.

---

## 8. Gotchas learned the hard way

- **Legacy vs new Supabase keys.** The app reads `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (a JWT starting `eyJ…`), not the new `sb_publishable_…` key. Using the wrong
  one breaks auth with "Invalid credentials"/"Invalid API key".
- **Project mismatch.** `.env.local` URL + keys must all be from the same
  Supabase project as where you ran the SQL and created the admin.
- **Clock skew.** WebAuthn challenge expiry is computed and checked in the app
  process's own clock (see `webauthn.ts`) precisely because a machine whose
  clock differs from Supabase's by minutes otherwise makes fresh challenges look
  expired. Keep dev machines time-synced anyway (also matters for JWT validity).
- **Resend sandbox** (`onboarding@resend.dev`) only delivers to your own
  Resend-account email. Verify a domain to email anyone else.
- **`supabase.auth.getUser()` before `auth.mfa.*`.** supabase-js warns
  ("insecure session") if MFA calls run on a client that hasn't authenticated
  the session first. The single-pass `loadGate()` calls `getUser()` up front.
- **Secure cookies on localhost.** `npm run start` sets `NODE_ENV=production`,
  which flips AAL cookies to `secure`. Browsers treat `localhost` as secure so
  it's usually fine; a non-localhost HTTP host would drop them.

---

## 9. Security notes

- RLS on every table; server-only tables (email/webauthn challenges,
  credentials) have **no** policies (service-role only).
- Service-role key confined to `server-only` modules; never in a client bundle.
- Email OTP hashed at rest, 5-attempt cap, 10-min expiry. AAL cookies are
  HMAC-signed with a per-cookie nonce and `timingSafeEqual` verification.
- Role checks run server-side on every render via `requireRole()`; `proxy.ts`
  only refreshes the session and gates public vs authenticated paths.
- No user enumeration on password reset (always shows the "sent" state).

---

## 10. Known gaps / next steps

- No automated tests.
- No rate limiting on `/login`, `/login/email`, `/forgot-password` (relies on
  Supabase's built-in limits) — add Upstash/Vercel KV for production.
- No admin **users** management UI (only invitations).
- Passkeys are per-device by nature; multi-device users register one each.
- Course/enrollment/grade features, audit log, SSO, i18n are all out of scope.

---

## 11. Common tasks → where to start

| Task | Start here |
|---|---|
| Add a role | `Role` type in `rbac.ts` + `profiles` check constraint (migration) |
| Add a 2FA method | extend `MfaConfig`/`chooseDispatch` in `rbac.ts`, add a `/login/<m>` page + enroll flow, mirror the cookie in `aal-cookie.ts` if it's cookie-based |
| Change email copy | `email.ts` (invite) and `email-otp.ts` (OTP) |
| Theme palette | `src/styles/globals.css` HSL tokens (`:root` and `.dark`) |
| Add an admin-only page | new dir under `(dashboard)/dashboard/admin/…`, start with `await requireRole('admin')` |
| Add an env var | append to `.env.example` and `env.ts` (with validation if required) |

---

## 12. Versions (snapshot)

Next.js `^16.0.0` (16.2.x), React `^19.2`, TypeScript `^5.6`, Tailwind `^3.4`,
`@supabase/ssr` `^0.5`, `@supabase/supabase-js` `^2.108`, `@simplewebauthn/*`
`^11`, `next-themes` `^0.4`, `resend` `^4`, `zod` `^3.23`.

*End of reference.*
