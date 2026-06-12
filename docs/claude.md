# University 2FA Authenticator — Project Reference

> **Purpose of this file.** A single, paste-able reference document so any AI
> assistant (or new developer) can get fully up to speed on this codebase
> without reading every file. Copy/paste the whole thing as context.

---

## 1. What this project is

A web app providing **invite-only sign-up** and **two-factor sign-in** for a
university portal. Users have one of three roles — `admin`, `teacher`,
`student` — and each lands on a role-specific dashboard after a successful
2FA challenge.

Two **independent** second-factor methods, chosen per-user at signup and
stored on `profiles.mfa_method`:

1. **Authenticator app (TOTP)** — Google Authenticator, Authy, Microsoft
   Authenticator, 1Password, etc. Handled by **Supabase's built-in MFA**
   (`auth.mfa_factors` table, `supabase.auth.mfa.*` API).
2. **Email code** — a 6-digit code emailed via **Resend** each sign-in. The
   code is hashed (SHA-256) and persisted in `public.email_otp_challenges`.
   Successful verification mints a short-lived signed HMAC cookie
   (`email_2fa`) that gates dashboard access until it expires.

A third flow exists for **recovery** if a TOTP user loses their authenticator
(see §6).

---

## 2. Stack and constraints

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js 15 (App Router)** + TypeScript | All backend logic lives in Server Actions + Route Handlers in the same project. |
| UI | Tailwind CSS (CSS-variable color tokens for dark mode) + a tiny hand-rolled component kit (Button, Input, Card, Label, PasswordInput) in `src/components/ui` | No shadcn install — same patterns, just inlined. |
| Font | **Inter** via `next/font/google` (`--font-inter` CSS variable). |
| Theme | **next-themes** v0.4, `attribute="class"`, default `system`. ThemeToggle in dashboard header + home page. |
| Auth backend | **Supabase** (Postgres + Auth + MFA + RLS) — free tier. |
| Email | **Resend** (free 100/day) — optional. If not configured, the app degrades gracefully (invites show the link in the UI, email-method 2FA refuses with an error). |
| Hosting | **Vercel Hobby** (free) — zero-config Next.js deploy. |
| Cost target | $0 — everything used here has a free tier sufficient for a small university. |

---

## 3. High-level architecture

```
Browser ──► Next.js App Router (RSC + Server Actions + Route Handlers)
                │
                ├─► Supabase Auth      (email + password → AAL1, TOTP → AAL2)
                ├─► Supabase Postgres  (profiles, invitations, email_otp_challenges)
                ├─► Supabase MFA       (auth.mfa_factors, TOTP enrollment/verify)
                └─► Resend             (email invitations, 6-digit OTP codes)
```

Two AAL-tracking mechanisms exist side-by-side:

- **TOTP method** → Supabase's native `session.aal` is promoted from `aal1` to
  `aal2` when `supabase.auth.mfa.verify()` succeeds. We just check it.
- **Email method** → We mint our own signed cookie `email_2fa`. The cookie
  payload is `<userId>.<expiry_ms>.<nonce>.<hmac>`, signed with
  `SUPABASE_SERVICE_ROLE_KEY` (which is already a high-entropy server secret).
  Cookie TTL: 12 hours.

`requireFullyAuthed()` in `src/lib/auth/rbac.ts` is the single dispatch point —
it loads `profiles.mfa_method` and checks the right signal.

---

## 4. Repository layout

```
src/
  app/
    layout.tsx                                 # Root layout: Inter font + ThemeProvider
    page.tsx                                   # Public landing (Sign in / I have an invite)

    (auth)/
      login/page.tsx + LoginForm + actions.ts          # Email + password (factor 1)
      login/totp/                                      # TOTP code entry (factor 2 for TOTP users)
      login/email/                                     # Email OTP entry (factor 2 for email users)
      signup/                                          # Invite-token signup
      onboarding/method/                               # Choose TOTP vs Email after signup
      onboarding/totp/                                 # QR + secret + verify (TOTP enrollment)
      forgot/                                          # Email recovery request
      forgot/verify/                                   # Enter recovery code → wipe old TOTP factor

    (dashboard)/
      layout.tsx                                       # Header (name, role, theme, sign out)
      dashboard/page.tsx                               # Index — redirects to /dashboard/<role>
      dashboard/admin/page.tsx
      dashboard/admin/invitations/page.tsx + InviteForm + actions.ts
      dashboard/teacher/page.tsx
      dashboard/student/page.tsx

    api/auth/signout/route.ts                          # Supabase signOut + clear email_2fa cookie

  components/
    LogoutButton.tsx
    ThemeProvider.tsx
    ThemeToggle.tsx
    ui/{button,card,input,label,password-input}.tsx

  lib/
    env.ts                                             # Strict env-var loader (throws on missing required)
    utils.ts                                           # cn() (clsx + tailwind-merge)
    email.ts                                           # Resend sender + invite email template
    supabase/{client,server,admin,middleware}.ts       # SSR-aware Supabase clients
    auth/
      rbac.ts                                          # getCurrentUser, requireUser, requireFullyAuthed, requireRole
      email-2fa-session.ts                             # HMAC-signed email_2fa cookie (issue/verify/clear)
      email-otp.ts                                     # 6-digit code generator, hash, issue, verify

  middleware.ts                                        # Session refresh + public-route guard

supabase/migrations/
  0001_init.sql                                        # profiles, invitations, RLS, webauthn_* (legacy)
  0002_switch_to_totp.sql                              # Drops webauthn_* and auth_sessions tables
  0003_method_choice_and_email_otp.sql                 # profiles.mfa_method + email_otp_challenges

docs/
  claude.md                                            # ← this file

.env.example                                           # Template for required + optional env vars
```

> **Route groups**: `(auth)` and `(dashboard)` are Next.js [route groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups) — they share a layout per group without affecting the URL.

---

## 5. Database schema (Postgres / Supabase)

### `public.profiles`
1:1 with `auth.users(id)`. Carries role and chosen 2FA method.

| column | type | notes |
|---|---|---|
| `id` | uuid PK references `auth.users(id)` on delete cascade | |
| `full_name` | text not null | |
| `email` | citext not null unique | mirrored from `auth.users.email` |
| `role` | text check (`'admin'|'teacher'|'student'`) | |
| `mfa_method` | text default `'totp'`, check (`'totp'|'email'`) | added in migration 0003 |
| `created_at` | timestamptz default now() | |

**RLS policies**
- `profiles_self_read`: row visible if `auth.uid() = id` OR caller is an admin.
- `profiles_self_update`: row updatable by its owner.

### `public.invitations`
Single-use, 7-day-expiring invite tokens.

| column | type |
|---|---|
| `id` | uuid PK default gen_random_uuid() |
| `email` | citext |
| `role` | text check (...) |
| `token` | text unique |
| `invited_by` | uuid → auth.users(id) on delete set null |
| `expires_at` | timestamptz default now() + 7d |
| `used_at` | timestamptz null |
| `created_at` | timestamptz default now() |

**RLS**: `invitations_admin_all` — only admins can read/write.

### `public.email_otp_challenges` (added in 0003)
One pending email-OTP challenge per user.

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid → auth.users(id) on delete cascade | |
| `code_hash` | text not null | SHA-256 hex of the 6-digit code |
| `attempts` | int default 0 | bumped on each wrong submission |
| `expires_at` | timestamptz default now() + 10m | |
| `consumed_at` | timestamptz null | set when code accepted |
| `created_at` | timestamptz default now() | |

**RLS**: **no policies** → only the service role bypass can touch it. This is
intentional; this table is server-only.

### Dropped tables (legacy)
`webauthn_credentials`, `webauthn_challenges`, `auth_sessions` were used by a
v1 passkey/WebAuthn flow that was replaced. Migration 0002 drops them.

---

## 6. Auth flows in detail

### 6.1 Signup (invite-only)

1. Admin posts to `createInviteAction` (
   `src/app/(dashboard)/dashboard/admin/invitations/actions.ts`):
   - Generates a 24-byte base64url `token`.
   - Inserts a row in `public.invitations`.
   - Calls `sendEmail()` with `inviteEmailTemplate({ link, role, inviter })`.
   - If Resend not configured, the action still succeeds but returns a
     `warning` describing the fallback.
2. Invitee opens `/signup?token=XYZ`:
   - `page.tsx` validates the token (`maybeSingle()` lookup, `used_at` null,
     not expired).
   - Form: full name + password (uses `<PasswordInput>` with eye toggle).
   - `signupAction` does, in order:
     a. Validates inputs via Zod.
     b. Re-validates the token (race-condition safe).
     c. `admin.auth.admin.createUser({ email_confirm: true, password, user_metadata })`.
     d. Inserts the matching `public.profiles` row.
     e. Marks invitation `used_at = now()`.
     f. Signs the user in via `supabase.auth.signInWithPassword()`.
     g. Redirects to `/onboarding/method`.
3. `/onboarding/method` shows two large buttons. The `chooseMethodAction`:
   - Persists `mfa_method` on the profile.
   - If TOTP: redirects to `/onboarding/totp`.
   - If Email: mints `email_2fa` cookie (invite proved inbox ownership) and
     redirects to the role dashboard.
4. `/onboarding/totp` calls `supabase.auth.mfa.enroll({ factorType: 'totp' })`
   server-side, renders the returned `qr_code` SVG inline and a
   "Can't scan? Show secret" toggle, then `verifyEnrollmentAction` does
   `mfa.challenge()` + `mfa.verify()`. Success → role dashboard.

### 6.2 Login

1. `/login` → `loginAction` calls `signInWithPassword`. On error, returns
   "Invalid credentials" (deliberately generic).
2. Looks up `profiles.mfa_method` via service role.
3. `'email'` → redirect `/login/email`.
   `'totp'` (or default) → check AAL; if `aal1 → aal2` available redirect
   `/login/totp`; if no factor yet redirect `/onboarding/method` (recovery
   case for users who never finished enrollment).
4. **`/login/totp`** uses Supabase MFA exactly as enrollment did. Success
   promotes session to AAL2.
5. **`/login/email`** runs `issueEmailOtp` server-side on render (sends one
   code immediately) and exposes a Resend button + Verify form. Verification:
   - Loads the latest non-consumed row for the user.
   - Checks expiry, attempt count, and SHA-256 hash.
   - On success → marks `consumed_at`, mints `email_2fa` cookie, redirects.
6. Dashboard guards use `requireRole(role)` → `requireFullyAuthed()` →
   dispatches on `mfa_method`. Wrong role → redirect to user's own dashboard.

### 6.3 Recovery (TOTP user lost authenticator)

1. From `/login/totp`, click **Recover via email**.
2. `/forgot` → `requestRecoveryAction` calls
   `supabase.auth.signInWithOtp({ email, shouldCreateUser: false })`.
   Always redirects to `/forgot/verify` regardless of email existence (no
   user enumeration).
3. `/forgot/verify` calls `verifyRecoveryAction` →
   `supabase.auth.verifyOtp({ type: 'email' })`. If success, uses the admin
   client to **list and delete all TOTP factors** for that user, then
   redirects to `/onboarding/totp` to re-enroll.

> Email-method users don't need recovery — losing the authenticator app is a
> non-event for them.

### 6.4 Sign out

`POST /api/auth/signout` calls `supabase.auth.signOut()` (which clears the
Supabase session cookies) and `clearEmail2faCookie()`.

---

## 7. RBAC (`src/lib/auth/rbac.ts`)

The single source of truth for "can this request see this page":

```ts
getCurrentUser()        → profile row or null
requireUser()           → redirect /login if no user
requireFullyAuthed()    → require user AND second-factor passed
                          (dispatches on profile.mfa_method)
requireRole(role)       → requireFullyAuthed + role match
                          (mismatched role redirects to user's own dashboard)
```

Pattern in pages:

```tsx
// admin-only page
export default async function AdminPage() {
  const user = await requireRole('admin');
  return <Whatever />;
}
```

Middleware (`src/middleware.ts`) only handles **session refresh** + a
"no session → /login" check on non-public paths. Fine-grained role enforcement
lives in `requireRole()` so it runs server-side on every render and can't be
spoofed by skipping the middleware.

Public paths: `/`, `/login`, `/signup`, `/forgot`. Everything else needs a
session (and most need AAL2 + role).

---

## 8. Environment variables

| name | required | purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL, e.g. `https://abcdefgh.supabase.co`. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase **anon** JWT (use Legacy API Keys tab in newer projects). |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Supabase **service_role** JWT. **Server-only.** Used for admin operations and as the HMAC key for the `email_2fa` cookie. |
| `NEXT_PUBLIC_APP_URL` | yes | Public origin, e.g. `http://localhost:3000` or `https://app.example.edu`. Used when composing invite links. |
| `RESEND_API_KEY` | optional | If unset, invite emails and email-method OTP are disabled (admin sees a warning telling them to share invite links manually). |
| `RESEND_FROM` | optional | Sender for Resend. Use `onboarding@resend.dev` for dev (delivers only to your Resend-account email). Use a verified domain in prod. |

`src/lib/env.ts` validates the four required variables at import time and
throws if any are missing — fail fast on misconfiguration.

`SUPABASE_SERVICE_ROLE_KEY` is imported only from `src/lib/supabase/admin.ts`
(starts with `import "server-only"`) and `src/lib/auth/email-2fa-session.ts`.
Next refuses to bundle these into the client.

---

## 9. Setup (greenfield)

### Local

1. Clone the repo, `npm install`.
2. Create a Supabase project on the Free tier.
3. In the SQL Editor, run migrations in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_switch_to_totp.sql`
   - `supabase/migrations/0003_method_choice_and_email_otp.sql`
4. Copy `.env.example` → `.env.local`, fill in Supabase keys
   (Legacy API Keys tab → anon + service_role).
5. (Optional) Resend account → API key → set `RESEND_API_KEY` +
   `RESEND_FROM`.
6. Seed first admin:
   - **Authentication → Users → Add user** with Auto Confirm User checked.
   - SQL Editor:
     ```sql
     insert into public.profiles (id, full_name, email, role)
     select id, 'Site Admin', email, 'admin'
     from auth.users
     where email = '<admin email>';
     ```
7. `npm run dev` → http://localhost:3000.

### Production (Vercel)

1. Push the repo to GitHub.
2. Import on Vercel. It auto-detects Next.js.
3. Set the four required env vars + the two optional Resend vars. Use the
   production `NEXT_PUBLIC_APP_URL` (e.g. `https://app.example.edu`).
4. After deploy, in Supabase **Authentication → URL Configuration**, set
   **Site URL** to the production origin. (Otherwise the magic-link recovery
   emails reference localhost.)

---

## 10. Operations cheat sheet

### Invite a new user
Dashboard → Invitations → enter email + role → submit. If Resend is wired,
email lands automatically; otherwise copy the link from the list and share
manually.

### Promote a user to admin
SQL Editor:
```sql
update public.profiles set role = 'admin' where email = '<email>';
```

### Reset a stuck user
1. **Authentication → Users** → delete the user (cascades to `profiles`,
   `email_otp_challenges`, `auth.mfa_factors`).
2. Issue a new invite from the admin dashboard.

### Switch a user's 2FA method (manual)
```sql
update public.profiles set mfa_method = 'email' where email = '<email>';
-- if switching FROM totp, also clear their factors:
delete from auth.mfa_factors where user_id = (
  select id from auth.users where email = '<email>'
);
```

A self-service "settings" UI for this is not built yet.

### Inspect MFA factors of a user
```sql
select id, factor_type, status, friendly_name, created_at
from auth.mfa_factors
where user_id = (select id from auth.users where email = '<email>');
```

---

## 11. Security notes / design choices

- **Service-role key** is only imported in `src/lib/supabase/admin.ts` and
  `src/lib/auth/email-2fa-session.ts`, both `import "server-only"`. Never
  reach for it from a client component.
- **RLS is on for every table.** Server-only tables
  (`email_otp_challenges`) have **no policies** — deny by default, service
  role bypasses for legitimate server code.
- **Email OTP** codes are stored hashed (SHA-256). The plaintext only ever
  lives in the outbound email. Five wrong attempts invalidate the code.
- **`email_2fa` cookie**: HMAC-SHA-256(payload, `SUPABASE_SERVICE_ROLE_KEY`).
  Includes a per-cookie nonce so two simultaneous sessions can't collide.
  Verified with `timingSafeEqual()`.
- **User enumeration on recovery** is avoided: `/forgot` always redirects to
  `/forgot/verify` regardless of email existence.
- **No user-visible Supabase error leakage on login** ("Invalid credentials"
  even if email is unknown).
- **Role-based access** is re-checked server-side on **every render** via
  `requireRole()`. The middleware does not enforce roles.

### Known gaps to know about

- Rate limiting on `/login`, `/login/email`, `/forgot` is not implemented in
  the app — relies on Supabase's built-in rate limits.
- No "Manage my 2FA / Sessions" page for end users.
- No admin UI for users management (only invitations).
- Production-grade email needs a verified Resend domain.

---

## 12. Code conventions

- **Server Actions for mutations** (no REST API where avoidable).
- **Route Handlers (`route.ts`) only when** an external/client integration
  needs JSON (currently just `/api/auth/signout`).
- **Validation** with Zod at the action boundary. Schemas live inline in the
  action file.
- **Returning state** from actions: `{ error?: string; success?: string;
  warning?: string; info?: string } | undefined`, consumed by
  `useActionState` on the client.
- **No client-side Supabase calls for auth flows** — everything goes through
  Server Actions so cookies are set on the response.
- **CSS color tokens** are HSL values in `globals.css` (light + dark themes);
  Tailwind references them as `hsl(var(--background) / <alpha-value>)`.
  Never hardcode colors in components.
- **Don't add backwards-compat shims** — if behavior changes, change the
  migration and the call sites.

---

## 13. Suggested next features (not built)

- Admin **Users** page: list, change role, delete, see enrolled factor.
- End-user **Settings** page: change password, switch 2FA method, see
  active sessions, view recovery codes.
- **Courses / enrollments / grades** — out-of-scope for v1 but a natural
  fit given the role system.
- **University SSO** (SAML / OIDC) as an additional auth provider via
  Supabase's external providers.
- **Audit log** for admin actions (invites issued, roles changed).
- **Rate limiting** (Upstash Ratelimit or Vercel KV) on auth endpoints.
- **i18n** with `next-intl`.

---

## 14. Pointers if you (future AI) need to do common tasks

| Task | Start here |
|---|---|
| Add a new role | `src/lib/auth/rbac.ts` Role type + SQL check constraint in `0001_init.sql` (will need a migration). |
| Add a new 2FA method | Extend `profiles.mfa_method` check, add branch in `requireFullyAuthed()` and `loginAction`, build new `/login/<method>` flow. |
| Customize emails | `src/lib/email.ts` (invite template) and `src/lib/auth/email-otp.ts` (OTP template). |
| Change theme palette | `src/styles/globals.css` (HSL tokens in `:root` and `.dark`). |
| Change Supabase MFA settings | `src/app/(auth)/onboarding/totp/page.tsx` (enroll call) and Supabase dashboard → Auth → MFA. |
| Add an admin-only page | Create under `src/app/(dashboard)/dashboard/admin/<new>/page.tsx`, start the server component with `await requireRole('admin')`. |
| Add a new env var | Append to `.env.example`, add to `src/lib/env.ts` (with validation if required). |

---

## 15. Tech versions in use (as of this snapshot)

- Next.js `^15.0.0`
- React `^18.3.1`
- TypeScript `^5.6.2`
- Tailwind CSS `^3.4.13`
- `@supabase/ssr` `^0.5.2`, `@supabase/supabase-js` `^2.45.4`
- `next-themes` `^0.4.3`
- `resend` `^4.0.0`
- `zod` `^3.23.8`
- `lucide-react` `^0.446.0`

When upgrading, the most likely break is the Supabase SSR cookie API — if
`createServerClient` complains about cookies, check `src/lib/supabase/server.ts`
and `src/lib/supabase/middleware.ts` against the current `@supabase/ssr` docs.

---

*End of reference. If something here disagrees with the code, the code wins
— please update this file as part of the same change.*
