# University 2FA Authenticator — AI Agent Context

This file is an operational context document for AI coding agents. It is not
end-user documentation. Read it before modifying authentication, authorization,
email, database, WebAuthn, deployment, or environment configuration.

Authority order:

1. Current source code and SQL migrations.
2. This document.
3. `README.md`, which may describe an older implementation.

If code behavior changes, update this file in the same change.

---

## 1. System identity

The repository implements an invite-only university portal authentication
foundation. It does not yet implement courses, grades, enrollment, or other
academic workflows.

Users have exactly one application role:

- `admin`
- `teacher`
- `student`

Authentication has two conceptual levels:

- **AAL1:** Supabase email/password session.
- **AAL2 equivalent:** the current session has passed at least one enabled
  second-factor method.

Supported second factors:

| Method | Authority and persistence | Session proof |
|---|---|---|
| TOTP authenticator | Supabase MFA (`auth.mfa_factors`) | Supabase session at `aal2` |
| Email OTP | App-generated challenge in `public.email_otp_challenges`; sent through Resend | Signed `email_2fa` cookie |
| Passkey/WebAuthn | App tables `webauthn_credentials` and `webauthn_challenges` | Signed `passkey_2fa` cookie |

At least one method must remain enabled. `profiles.mfa_method` is a preference,
not the complete enabled-method state.

There is no self-service recovery when TOTP is the only enabled method and the
user loses it. A user who retains email OTP or a passkey can authenticate with
that fallback, remove the old TOTP factor in Settings, and enroll a new one.

---

## 2. Technology snapshot

- Next.js 16 App Router using the Next 16 `proxy.ts` convention
- React 19.2 and TypeScript with strict checking
- Tailwind CSS 3 and small repository-local UI primitives
- Supabase Auth, Postgres, MFA, SSR clients, and RLS
- Resend SDK for application-owned email
- Resend SMTP for Supabase-owned authentication email
- `@simplewebauthn/server` and `@simplewebauthn/browser`
- Vercel Hobby hosting
- deSEC DNS with a free `dedyn.io` zone

Package versions are governed by `package.json` and `package-lock.json`; do not
rely on version numbers copied into this document.

---

## 3. Current production topology

Current public application origin:

```text
https://www.university-portal.dedyn.io
```

The browser may visually hide the `www` prefix. Configuration must still use
the full origin above.

Infrastructure map:

```text
                                ┌──────────────────────────────┐
                                │ deSEC authoritative DNS     │
                                │ university-portal.dedyn.io  │
                                │                              │
Browser ── DNS lookup ─────────▶│ www CNAME → Vercel          │
                                │ DKIM/SPF/MX/DMARC → Resend   │
                                └──────────────┬───────────────┘
                                               │
                                               ▼
┌──────────────┐ HTTPS  ┌────────────────────────────────────────────┐
│ User browser │───────▶│ Vercel: Next.js application               │
└──────────────┘        │ Server Components, Actions, Route Handlers │
                        └──────────────┬─────────────────┬───────────┘
                                       │                 │
                         Auth/DB/MFA   │                 │ HTTPS API
                                       ▼                 ▼
                        ┌────────────────────┐   ┌──────────────────┐
                        │ Supabase          │   │ Resend           │
                        │ Auth + Postgres   │   │ invites + OTPs   │
                        └─────────┬──────────┘   └─────────┬────────┘
                                  │ SMTP                    │ email
                                  │ smtp.resend.com         │
                                  └──────────────▶ Resend ───┘
                                                        │
                                                        ▼
                                                 Recipient inbox
```

### DNS facts

The deSEC zone is `university-portal.dedyn.io`.

- `www` is a CNAME to the Vercel-provided project target.
- The root `dedyn.io` hostname is not used for web hosting. deSEC rejected the
  Vercel apex A address, so the production application uses `www`.
- `resend._domainkey` TXT authenticates Resend DKIM.
- `send` MX and TXT records provide Resend return-path/SPF configuration.
- `_dmarc` TXT currently uses a monitoring policy (`p=none`).
- Resend has verified `university-portal.dedyn.io` for sending.

Do not replace the Vercel CNAME with a hard-coded value from this document.
Read the exact active target from Vercel before changing DNS.

### Shared database warning

Development and production currently use the same Supabase project/database.
Treat local writes, migrations, test users, invitation consumption, factor
deletion, and cleanup as production-affecting operations. Never assume local
testing is isolated.

---

## 4. Email ownership and delivery map

There are two independent email pipelines. Debug them separately.

### Pipeline A: Vercel application → Resend API

Used for:

- Admin invitation emails.
- Six-digit email second-factor codes.

Path:

```text
Server Action / Server Component
  → src/lib/email.ts
  → Resend HTTPS API using RESEND_API_KEY
  → recipient
```

Call sites:

- `src/app/(dashboard)/dashboard/admin/invitations/actions.ts`
- `src/lib/auth/email-otp.ts`

Required Vercel variables:

- `RESEND_API_KEY`
- `RESEND_FROM`, currently expected to use a sender such as
  `University Portal <auth@university-portal.dedyn.io>`

An invalid Vercel key produces an application warning such as `API key is
invalid`. Changing Supabase SMTP does not fix Pipeline A.

### Pipeline B: Supabase Auth → Resend SMTP

Used for:

- Password recovery.
- Any other Supabase-native authentication email enabled later.

Path:

```text
Supabase Auth
  → smtp.resend.com:465
  → Resend using SMTP password/API key
  → recipient
```

Supabase SMTP settings:

```text
Sender address: auth@university-portal.dedyn.io
Sender name:    University Portal
Host:           smtp.resend.com
Port:           465
Username:       resend
Password:       a valid Resend API key
```

Changing Vercel `RESEND_API_KEY` does not automatically update Supabase SMTP.
When rotating the key, update both systems if they intentionally share it.

### Resend sandbox constraint

`onboarding@resend.dev` can send only to the email address attached to the
Resend account. Production must use the verified
`university-portal.dedyn.io` sender.

---

## 5. Repository map

```text
src/
  app/
    layout.tsx
    page.tsx
    (auth)/
      login/
        actions.ts                    # password sign-in and factor dispatch
        choose/                       # method choice when multiple are enabled
        email/                        # issue and verify app-owned email OTP
        totp/                         # Supabase MFA challenge and verify
        passkey/                      # browser WebAuthn assertion
      signup/                         # consume application invitation
      onboarding/
        method/                       # initial TOTP/email choice
        totp/                         # initial Supabase TOTP enrollment
      forgot-password/                # request Supabase recovery email
      reset-password/                 # update password in recovery session
    (dashboard)/
      layout.tsx                      # fully-authenticated shell
      dashboard/
        page.tsx                      # role redirect
        admin/
          page.tsx
          invitations/               # create and list invitations
        teacher/page.tsx
        student/page.tsx
        settings/
          actions.ts                  # factor/default mutations
          authenticator/              # TOTP enrollment from Settings
          passkey/                    # WebAuthn registration from Settings
    api/
      auth/signout/                   # clear custom AAL cookies + Supabase
      webauthn/
        register-options/
        register-verify/
        auth-options/
        auth-verify/
    auth/
      confirm/                        # token_hash verification; preferred email flow
      callback/                       # legacy PKCE code exchange
  components/
    ProfileMenu.tsx
    ThemeProvider.tsx
    ThemeToggle.tsx
    ui/
  lib/
    env.ts
    email.ts
    auth/
      rbac.ts                         # authoritative auth gate and redirects
      aal-cookie.ts                   # signed email/passkey AAL proof
      email-otp.ts                    # app-owned OTP lifecycle
      webauthn.ts                     # WebAuthn ceremonies and persistence
    supabase/
      client.ts                       # browser client
      server.ts                       # cookie-backed server client
      admin.ts                        # service-role client; server-only
      middleware.ts                   # session refresh used by proxy
  proxy.ts                            # coarse public/authenticated routing
  styles/globals.css
supabase/migrations/
  0001_init.sql
  0002_switch_to_totp.sql
  0003_method_choice_and_email_otp.sql
  0004_independent_2fa_toggles.sql
  0005_passkey_2fa.sql
```

Migration history is intentionally non-linear:

- `0001` contains an obsolete first WebAuthn design.
- `0002` removes those tables when the project switched to TOTP.
- `0005` adds the current WebAuthn schema.

On a new database, apply all migrations in numerical order.

---

## 6. Data model and ownership

All application tables have RLS enabled.

### `public.profiles`

One row per `auth.users` row.

Relevant fields:

- `id uuid` referencing `auth.users(id)` with cascade delete
- `full_name`
- `email citext unique`
- `role`: `admin | teacher | student`
- `mfa_method`: `totp | email | passkey`
- `email_2fa_enabled boolean`

RLS permits self-read/self-update and admin reads. Privileged server operations
often use the service-role client.

### `public.invitations`

- Random, single-use token.
- Seven-day default lifetime.
- `used_at` is independent of whether a user is later deleted.
- Deleting a Supabase Auth user does not reset or remove an invitation.
- Duplicate invitation rows for the same email are currently allowed.
- Admin-only policy.

Signup order matters:

1. Validate invitation.
2. Create auto-confirmed Supabase Auth user.
3. Insert profile.
4. Mark invitation used.
5. Sign the new user in.
6. Redirect to method onboarding.

If an error occurs after step 4, reopening the link correctly reports it as
used. Inspect Auth users, profiles, and Vercel logs before deleting state.

### `public.email_otp_challenges`

- Server-only: RLS enabled with no authenticated policies.
- Stores SHA-256 code hash, not plaintext code.
- Ten-minute expiry from database default.
- Maximum five failed attempts.
- Issuing a new code deletes outstanding unconsumed challenges first.

### `public.webauthn_credentials`

- Server-only.
- Stores credential id, base64 public key, signature counter, transports,
  optional device name, and timestamps.
- Current UI treats one or more rows as “passkey enabled.”
- Removing passkey currently deletes all user credentials.

### `public.webauthn_challenges`

- Server-only and single-use.
- Purpose is `register` or `authenticate`.
- Application computes and validates expiry using its own clock to avoid
  app/database clock-skew failures.

### Supabase-owned auth data

- Passwords and sessions live in Supabase Auth.
- TOTP factors live in Supabase `auth.mfa_factors`.
- Never attempt to store or duplicate TOTP secrets in public application tables.

---

## 7. Authentication gate: authoritative behavior

`src/lib/auth/rbac.ts` is the central access-control module.

`loadGate()` loads:

- authenticated Supabase user via `getUser()`
- application profile
- Supabase MFA factors
- Supabase authenticator assurance level
- existence of a WebAuthn credential
- signed email/passkey AAL cookies

Derived method state:

```text
totpEnabled    = at least one verified Supabase TOTP factor
emailEnabled   = profiles.email_2fa_enabled
passkeyEnabled = at least one WebAuthn credential row
preferred      = profiles.mfa_method
```

The gate passes when any currently enabled method has valid session proof:

```text
(totpEnabled    && Supabase currentLevel === "aal2")
OR
(emailEnabled   && valid email_2fa cookie)
OR
(passkeyEnabled && valid passkey_2fa cookie)
```

A stale cookie from a disabled method does not pass the gate.

Dispatch:

```text
0 enabled methods → /onboarding/method
1 enabled method  → that method's challenge
2–3 methods       → /login/choose
```

Helpers:

- `requireMfaGate()` is for second-factor pages.
- `requireFullyAuthed()` protects general dashboard content.
- `requireRole()` protects role-specific content.
- `getMfaConfig()` loads Settings state.
- `loginRedirectFor()` exposes dispatch to the login action.

`proxy.ts` is not the security boundary. It refreshes Supabase cookies and
performs coarse “session exists” routing. Page/Action/Route code must still use
the server-side gate appropriate to the operation.

---

## 8. Session and cookie model

Supabase manages AAL1 cookies and native TOTP AAL2.

Email and passkey methods use custom signed cookies from
`src/lib/auth/aal-cookie.ts`:

```text
<userId>.<expiryMs>.<nonce>.<HMAC-SHA256>
```

Properties:

- Separate names: `email_2fa`, `passkey_2fa`
- HMAC key: `SUPABASE_SERVICE_ROLE_KEY`
- TTL: 12 hours
- `HttpOnly`
- `SameSite=Lax`
- `Secure` in production
- constant-time signature comparison

Operational implication: rotating `SUPABASE_SERVICE_ROLE_KEY` invalidates all
custom AAL cookies in addition to affecting admin API access.

Sign-out and password-reset completion clear both custom cookies.

---

## 9. End-to-end flows

### Invitation and signup

```text
Admin AAL2 session
  → create invitation row
  → build link from NEXT_PUBLIC_APP_URL
  → send through Resend API
  → recipient opens /signup?token=...
  → create Auth user + profile
  → consume invitation
  → password sign-in
  → /onboarding/method
```

Email is enabled by default at the schema level. Initial onboarding UI offers
TOTP or email, not passkey. Passkey can be enrolled later in Settings.

### Password login and second factor

```text
/login
  → signInWithPassword (AAL1)
  → derive enabled methods
  → one method: direct challenge
  → multiple methods: /login/choose
  → successful factor proof
  → role dashboard
```

The `next` form value is currently parsed but not honored by `loginAction`;
successful login dispatches by MFA state.

### Email OTP

Visiting `/login/email` issues an OTP during server rendering. Refreshing or
re-entering the page may invalidate the previous code and send another email.
The resend action also issues a new challenge. There is no application-level
rate limiter.

Successful verification consumes the challenge, issues `email_2fa`, and routes
to the role dashboard.

### TOTP

Enrollment and login call `getUser()` before `supabase.auth.mfa.*`. Preserve
that ordering; current Supabase clients warn or reject insecure session use
otherwise.

### Passkey

Registration/authentication options are generated server-side, persisted as
single-use challenges, completed in the browser, and verified server-side.

WebAuthn identity is origin-bound. Production configuration must match the
actual `www` origin exactly.

### Password recovery

Request:

```text
/forgot-password
  → Supabase resetPasswordForEmail()
  → Supabase sends through Resend SMTP
```

Required Supabase **Reset Password** email template link:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">
  Reset password
</a>
```

Confirmation:

```text
/auth/confirm
  → validate type and local next path
  → verifyOtp(token_hash, recovery)
  → set cookie-backed recovery session
  → /reset-password
  → update password
  → sign out and clear custom AAL cookies
  → /login?reset=ok
```

`/auth/confirm` is preferred because token-hash verification is not coupled to
a PKCE verifier stored in the browser that requested the email. It works when
the email is opened in another browser or device.

`/auth/callback` remains as a legacy PKCE code-exchange route. Do not point the
Reset Password template at it. A missing verifier produces `PKCE code verifier
not found in storage`.

---

## 10. Settings invariants

`src/app/(dashboard)/dashboard/settings/actions.ts` must preserve:

- The user always has at least one enabled method.
- A disabled/removed preferred method is replaced with another enabled method.
- Disabling email clears `email_2fa`.
- Removing passkeys clears `passkey_2fa`.
- TOTP deletion uses the Supabase admin MFA API.
- Passkey deletion currently removes all credentials.
- Mutations require a fully authenticated user before service-role writes.

Do not move these invariants solely into client-side button state.

---

## 11. Environment contract

| Variable | Runtime | Meaning |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public/server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public/server | Supabase legacy anon JWT used by current code |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Admin Supabase operations and custom AAL HMAC secret |
| `NEXT_PUBLIC_APP_URL` | public/server | Canonical origin used in invitation/recovery links |
| `RESEND_API_KEY` | server only | Pipeline A Resend API authorization |
| `RESEND_FROM` | server only | Pipeline A verified sender |
| `NEXT_PUBLIC_RP_ID` | optional public | WebAuthn RP ID override |
| `NEXT_PUBLIC_RP_NAME` | optional public | WebAuthn display name |
| `NEXT_PUBLIC_RP_ORIGIN` | optional public | WebAuthn expected origin override |

Production canonical values:

```text
NEXT_PUBLIC_APP_URL=https://www.university-portal.dedyn.io
NEXT_PUBLIC_RP_ID=www.university-portal.dedyn.io
NEXT_PUBLIC_RP_ORIGIN=https://www.university-portal.dedyn.io
```

`env.ts` derives RP ID and origin from APP URL when overrides are absent. Avoid
setting stale explicit overrides.

The repository currently expects `NEXT_PUBLIC_SUPABASE_ANON_KEY`, not
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, even if both exist in a local env file.

Vercel environment changes require a redeployment to affect an existing
production build.

Never expose:

- service-role keys
- Resend API keys
- deSEC update/authorization tokens
- invitation tokens before intended delivery
- WebAuthn challenge payloads in logs

---

## 12. Supabase dashboard contract

URL Configuration:

```text
Site URL:
https://www.university-portal.dedyn.io

Allowed redirect URLs:
https://www.university-portal.dedyn.io/auth/callback
http://localhost:3000/auth/callback
```

The token-hash recovery link uses `.SiteURL` and `/auth/confirm`; keep the Site
URL accurate even though `/auth/confirm` does not depend on the redirect allow
list in the same way as PKCE.

Custom SMTP must remain enabled with the verified sender and valid Resend key.
The Reset Password template must use the token-hash URL documented above.

All migrations `0001` through `0005` are reported as applied to the active
Supabase project.

---

## 13. Security boundaries

- Never import `src/lib/supabase/admin.ts` into a Client Component.
- Keep `server-only` on service-role and cryptographic modules.
- Never trust role, user id, factor id, method state, or redirect destination
  supplied only by the client.
- Use `getUser()`, not `getSession()`, as the server authorization source.
- Validate redirect paths as local paths; reject `//host` and absolute URLs.
- Challenge tables intentionally have RLS enabled and no user policies.
- Email OTP values must remain hashed at rest.
- WebAuthn challenges must remain single-use.
- Invitation links are bearer credentials; do not log them unnecessarily.
- Password-reset responses intentionally avoid account enumeration.

Server Actions may use the service role only after authenticating and
authorizing the caller with `requireFullyAuthed()` or `requireRole()`.

---

## 14. Diagnostics decision tree

### Invitation or email OTP says “API key is invalid”

Check Pipeline A:

1. Vercel `RESEND_API_KEY`
2. variable applies to Production
3. production was redeployed
4. key has sending access to the verified domain
5. `RESEND_FROM` uses the verified domain
6. Resend API logs

Do not debug Supabase SMTP for this error.

### Password reset email is not sent

Check Pipeline B:

1. Supabase custom SMTP enabled
2. SMTP password is a valid Resend key
3. sender is `@university-portal.dedyn.io`
4. Resend logs
5. Supabase Auth logs and rate limits

### Recovery link returns PKCE verifier error

The email used an old template/link or an old already-sent message. Confirm the
Reset Password template uses `/auth/confirm` with `.TokenHash`, then request a
new email. Previously sent links do not change when the template changes.

### Invitation says invalid after signup crashed

Check, in order:

1. Supabase Auth user exists
2. matching `profiles` row exists
3. invitation `used_at`
4. Vercel logs for `/signup` or `/onboarding/method`

Do not delete the user before collecting evidence. User deletion does not reset
the invitation.

### Generic “This page couldn’t load”

This is not enough to identify a client bug. Correlate:

- route and exact timestamp
- Vercel Function/Runtime logs
- browser console and Network response
- whether the error reproduces after hard navigation
- whether it occurs only on localhost, where the dev server may have stopped

Fix the underlying server/client exception; an error boundary is not a root
cause fix.

### WebAuthn fails only in production

Compare:

- browser origin
- `NEXT_PUBLIC_APP_URL`
- RP ID
- RP origin
- Vercel primary domain

`www.university-portal.dedyn.io` and `university-portal.dedyn.io` are different
WebAuthn RP/origin configurations.

---

## 15. Known gaps

- No automated test suite.
- No application-level rate limiting for password login, email OTP issuance,
  or password reset.
- Email OTP is issued as a render side effect on `/login/email`.
- No self-service recovery when the sole TOTP factor is lost.
- No invitation revoke/delete/resend UI.
- Duplicate invitations for one email are allowed.
- No admin user-management UI.
- No audit-log UI.
- Passkey UI does not manage credentials individually.
- `loginAction` does not honor the requested `next` destination.
- Development and production are not database-isolated.
- Course, enrollment, assignment, and grade features are not implemented.

---

## 16. Change routing for agents

| Requested change | Primary files |
|---|---|
| Role or authorization behavior | `src/lib/auth/rbac.ts`, dashboard pages, new migration |
| Add or alter a 2FA method | `rbac.ts`, challenge/enrollment routes, Settings actions, persistence migration |
| Invitation behavior | admin invitation Action/page, signup Action/page, `src/lib/email.ts` |
| App-owned email templates | `src/lib/email.ts`, `src/lib/auth/email-otp.ts` |
| Supabase recovery email | Supabase dashboard template + `src/app/auth/confirm/route.ts` |
| Password reset behavior | forgot/reset Actions and auth confirm route |
| TOTP behavior | onboarding/settings TOTP pages and Supabase MFA calls |
| Passkey behavior | `src/lib/auth/webauthn.ts` and four WebAuthn API routes |
| Session proof | `src/lib/auth/aal-cookie.ts`, `rbac.ts`, sign-out/reset paths |
| Database shape | append a migration; do not rewrite applied migration history |
| Production origin/domain | Vercel domain/env, deSEC DNS, Supabase URL config, WebAuthn RP config |
| Theme/UI primitives | `src/styles/globals.css`, Tailwind config, `src/components/ui` |

Before completing auth or deployment work:

1. Inspect the active code path rather than relying only on this document.
2. Preserve unrelated user changes.
3. Run `npm run typecheck`.
4. Run `npm run build` when dependencies/network permit.
5. State any required Supabase, Resend, Vercel, or DNS dashboard changes; code
   changes alone cannot update external configuration.
6. Update this document when architecture or invariants change.
