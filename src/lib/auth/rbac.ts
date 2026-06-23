import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verifyEmail2faCookie } from "@/lib/auth/email-2fa-session";
import { verifyPasskey2faCookie } from "@/lib/auth/passkey-2fa-session";
import { userHasPasskey } from "@/lib/auth/webauthn";

export type Role = "admin" | "teacher" | "student";
export type MfaMethod = "totp" | "email" | "passkey";

export type MfaConfig = {
  totpEnabled: boolean;
  emailEnabled: boolean;
  passkeyEnabled: boolean;
  preferred: MfaMethod;
};

export async function getCurrentUser() {
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
  return profile
    ? {
        ...profile,
        role: profile.role as Role,
        mfa_method: profile.mfa_method as MfaMethod,
        email_2fa_enabled: profile.email_2fa_enabled as boolean,
      }
    : null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * The user's effective 2FA configuration. TOTP is enabled iff a verified
 * factor exists. Email is enabled iff the column is true. Passkey is enabled
 * iff there's at least one registered WebAuthn credential.
 */
export async function getMfaConfig(): Promise<MfaConfig | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("mfa_method, email_2fa_enabled")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totpEnabled = (factors?.totp?.length ?? 0) > 0;
  const emailEnabled = profile.email_2fa_enabled as boolean;
  const passkeyEnabled = await userHasPasskey(user.id);
  const preferred = (profile.mfa_method as MfaMethod) ?? "email";

  return { totpEnabled, emailEnabled, passkeyEnabled, preferred };
}

/**
 * True iff the current session has cleared the second factor by an ENABLED
 * mechanism. A passing signal from a method the user has since disabled does
 * not count.
 */
export async function hasPassedSecondFactor(
  userId: string,
  config: MfaConfig,
): Promise<boolean> {
  const supabase = await createClient();
  // Authenticate the session before reading anything session-derived.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (config.totpEnabled && aal?.currentLevel === "aal2") return true;
  if (config.emailEnabled && (await verifyEmail2faCookie(userId))) return true;
  if (config.passkeyEnabled && (await verifyPasskey2faCookie(userId))) return true;
  return false;
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

export async function requireFullyAuthed() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login");

  const config = await getMfaConfig();
  if (!config) redirect("/login");

  if (await hasPassedSecondFactor(profile.id, config)) return profile;
  redirect(chooseDispatch(config));
}

export async function requireRole(role: Role | Role[]) {
  const user = await requireFullyAuthed();
  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(user.role)) redirect(`/dashboard/${user.role}`);
  return user;
}

export function loginRedirectFor(config: MfaConfig): string {
  return chooseDispatch(config);
}
