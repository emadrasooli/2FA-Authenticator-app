import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verifyAal2Cookie } from "@/lib/auth/aal-cookie";
import { userHasPasskey } from "@/lib/auth/webauthn";

export type Role = "admin" | "teacher" | "student";
export type MfaMethod = "totp" | "email" | "passkey";

export type MfaConfig = {
  totpEnabled: boolean;
  emailEnabled: boolean;
  passkeyEnabled: boolean;
  preferred: MfaMethod;
};

export type SessionUser = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  mfa_method: MfaMethod;
  email_2fa_enabled: boolean;
};

export type MfaGate = {
  user: SessionUser;
  config: MfaConfig;
  /** Has the current session cleared 2FA via a currently-enabled method? */
  passed: boolean;
  /** First TOTP factor, if any — so the /login/totp page needn't re-list. */
  totpFactor: { id: string; friendlyName: string | null } | null;
};

/**
 * Single-pass loader for everything the auth guards need: one getUser() (a
 * network round-trip to Supabase), one profile query, one factor list, one AAL
 * check. Deriving config + passed from that avoids the 2–3× redundant getUser()
 * calls the guards used to make per render.
 *
 * TOTP is enabled iff a verified factor exists; email iff the column is true;
 * passkey iff a registered credential exists. `passed` only counts a signal
 * from a currently-enabled method, so disabling a method invalidates a stale
 * cookie/AAL immediately.
 */
async function loadGate(): Promise<MfaGate | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, mfa_method, email_2fa_enabled")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  const totp = factors?.totp?.[0] ?? null;
  const totpEnabled = totp !== null;
  const emailEnabled = profile.email_2fa_enabled as boolean;
  const passkeyEnabled = await userHasPasskey(user.id);
  const preferred = (profile.mfa_method as MfaMethod) ?? "email";

  const config: MfaConfig = {
    totpEnabled,
    emailEnabled,
    passkeyEnabled,
    preferred,
  };

  const passed =
    (totpEnabled && aal?.currentLevel === "aal2") ||
    (emailEnabled && (await verifyAal2Cookie("email", user.id))) ||
    (passkeyEnabled && (await verifyAal2Cookie("passkey", user.id)));

  return {
    user: {
      id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      role: profile.role as Role,
      mfa_method: preferred,
      email_2fa_enabled: emailEnabled,
    },
    config,
    passed,
    totpFactor: totp
      ? { id: totp.id, friendlyName: totp.friendly_name ?? null }
      : null,
  };
}

function chooseDispatch(config: MfaConfig): string {
  const enabledCount =
    (config.totpEnabled ? 1 : 0) +
    (config.emailEnabled ? 1 : 0) +
    (config.passkeyEnabled ? 1 : 0);
  if (enabledCount === 0) return "/onboarding/method";
  if (enabledCount > 1) return "/login/choose";
  if (config.totpEnabled) return "/login/totp";
  if (config.passkeyEnabled) return "/login/passkey";
  return "/login/email";
}

/** For the login challenge pages — returns the full gate or redirects to /login. */
export async function requireMfaGate(): Promise<MfaGate> {
  const gate = await loadGate();
  if (!gate) redirect("/login");
  return gate;
}

/** Config only — used by the settings screens. */
export async function getMfaConfig(): Promise<MfaConfig | null> {
  const gate = await loadGate();
  return gate?.config ?? null;
}

export async function requireFullyAuthed(): Promise<SessionUser> {
  const gate = await loadGate();
  if (!gate) redirect("/login");
  if (gate.passed) return gate.user;
  redirect(chooseDispatch(gate.config));
}

export async function requireRole(role: Role | Role[]): Promise<SessionUser> {
  const user = await requireFullyAuthed();
  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(user.role)) redirect(`/dashboard/${user.role}`);
  return user;
}

export function loginRedirectFor(config: MfaConfig): string {
  return chooseDispatch(config);
}
