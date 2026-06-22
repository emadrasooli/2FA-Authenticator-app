import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verifyEmail2faCookie } from "@/lib/auth/email-2fa-session";

export type Role = "admin" | "teacher" | "student";
export type MfaMethod = "totp" | "email";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, mfa_method")
    .eq("id", user.id)
    .maybeSingle();
  return profile
    ? {
        ...profile,
        role: profile.role as Role,
        mfa_method: profile.mfa_method as MfaMethod,
      }
    : null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Returns true if the current session has cleared the second factor by EITHER
 * mechanism: a verified TOTP factor (Supabase AAL2) or a verified email code
 * (our signed email_2fa cookie). The two are interchangeable fallbacks.
 */
export async function hasPassedSecondFactor(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2") return true;
  return verifyEmail2faCookie(userId);
}

export async function requireFullyAuthed() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login");

  if (await hasPassedSecondFactor(profile.id)) return profile;

  // Not cleared yet → send to the user's primary challenge.
  if (profile.mfa_method === "email") redirect("/login/email");
  redirect("/login/totp");
}

export async function requireRole(role: Role | Role[]) {
  const user = await requireFullyAuthed();
  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(user.role)) redirect(`/dashboard/${user.role}`);
  return user;
}
