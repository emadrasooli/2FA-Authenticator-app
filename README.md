# University 2FA Authenticator

A free-tier-only web app implementing **invite-only sign-up** and **two-factor sign-in** for a university portal:

- **Factor 1**: email + password (Supabase Auth)
- **Factor 2**: 6-digit code from an **authenticator app** (Google Authenticator, Authy, Microsoft Authenticator, 1Password, etc.) — uses Supabase's built-in MFA (TOTP)
- **Recovery**: email OTP if the user loses their authenticator

Roles: `admin`, `teacher`, `student` — each gets a role-specific dashboard.

## Stack

- Next.js 15 (App Router) + TypeScript
- Supabase (Postgres + Auth + MFA + RLS) — free tier
- Tailwind CSS
- Deploys to Vercel Hobby (free)

## 1. Create a Supabase project

1. Sign up at <https://supabase.com> and create a new project (Free tier).
2. In the SQL editor, run `supabase/migrations/0001_init.sql`, then `supabase/migrations/0002_switch_to_totp.sql` (in order).
3. In **Authentication → Sign In / Providers → Multi-Factor Authentication**, ensure **TOTP** is enabled (it's on by default).
4. In **Project Settings → API Keys → Legacy anon, service_role API keys**, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only!)

### Seed the first admin

1. **Authentication → Users → Add user** in the Supabase dashboard. Set email + password, check **Auto Confirm User**.
2. In SQL editor (no copy-paste of UIDs needed):
   ```sql
   insert into public.profiles (id, full_name, email, role)
   select id, 'Site Admin', email, 'admin'
   from auth.users
   where email = 'admin@example.edu';
   ```
3. You can now sign in at `/login` as the admin. Because no authenticator is enrolled yet, you'll be redirected to `/onboarding/totp` to register one.

## 2. Configure local env

```bash
cp .env.example .env.local
# fill in the three Supabase values
```

### Optional — email invitations via Resend

Without this, admin invites are still created and the link is displayed in the dashboard for you to copy/share. To have the link automatically emailed to the invitee:

1. Sign up at <https://resend.com> (free tier: 100 emails/day, 3000/month).
2. **API Keys → Create API Key** → copy it into `.env.local` as `RESEND_API_KEY`.
3. **Domains** (or use the sandbox sender `onboarding@resend.dev`):
   - **Sandbox** (`onboarding@resend.dev`): zero setup, but Resend will only deliver to **your own** Resend-account email — fine for dev.
   - **Verified domain** (production): add your domain → add the DNS records Resend shows → wait for verification → put e.g. `noreply@yourdomain.edu` in `RESEND_FROM`.
4. Restart `npm run dev`.

## 3. Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## 4. End-to-end flow

1. Sign in as the seeded admin → scan the QR code with your authenticator app → enter the 6-digit code → land on `/dashboard/admin`.
2. Go to **Invitations** → create an invite for a teacher or student email.
3. Copy the invite link, open it in incognito → set name + password → scan QR → enter 6-digit code → land on the correct role dashboard.
4. Sign out, sign back in: password → 6-digit code from app → dashboard.

### If a user loses their authenticator

1. On `/login/totp`, click **Recover via email**.
2. Enter the account email → server sends a 6-digit code via Supabase email OTP.
3. Enter the code → server deletes the old TOTP factor → user is redirected to `/onboarding/totp` to enroll a new one.

## 5. Deploy to Vercel

1. Push this repo to GitHub.
2. On Vercel → **Add New Project** → import the repo.
3. Set environment variables (production):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` = `https://your-app.vercel.app`
4. Deploy.
5. In Supabase **Authentication → URL Configuration**, set **Site URL** to your Vercel domain.

> For high-volume email OTPs in production, plug in **Resend** (100 free/day) in Supabase → **Project Settings → Authentication → SMTP Settings**.

## Project layout

```
src/
  app/
    (auth)/login                       # email + password
    (auth)/login/totp                  # 6-digit code from authenticator app
    (auth)/signup                      # invite-token signup
    (auth)/onboarding/totp             # first-time TOTP enrollment (QR + verify)
    (auth)/forgot                      # email OTP recovery (request)
    (auth)/forgot/verify               # enter email code → reset TOTP
    (dashboard)/dashboard/{admin,teacher,student}
    (dashboard)/dashboard/admin/invitations
    api/auth/signout
  lib/
    supabase/{client,server,admin,middleware}.ts
    auth/rbac.ts                       # requireRole, requireFullyAuthed (uses Supabase AAL2)
    env.ts
  components/ui/                       # button, input, card, label
  middleware.ts                        # session refresh + guard
supabase/migrations/
  0001_init.sql                        # profiles, invitations, RLS
  0002_switch_to_totp.sql              # drop WebAuthn tables (cleanup)
```

## Security model

- **RLS on every table.** Users can only read their own `profiles`. Admins can read all profiles and manage invitations.
- The `SUPABASE_SERVICE_ROLE_KEY` is imported only in `src/lib/supabase/admin.ts`, which starts with `import "server-only"` so Next will refuse to bundle it into the client.
- After password sign-in the session is **AAL1**. Dashboards require **AAL2**, which only `mfa.verify()` can grant — so password alone is not enough to reach any dashboard.
- TOTP secrets live in Supabase's `auth.mfa_factors` table (server-side, encrypted at rest by Supabase).
- Recovery via email OTP is gated by Supabase's standard OTP rate limits; after verification we delete the old TOTP factor with the service role before letting the user enroll a new one.
- `requireRole('admin')` etc. re-checks the role server-side on every render — never trust the client.

## What's not built (v1)

Courses / assignments / grades, audit log UI, SSO with university IdP, multi-authenticator management UI, i18n. The auth foundation is the focus.
