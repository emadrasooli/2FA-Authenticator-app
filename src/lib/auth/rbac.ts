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

export async function requireFullyAuthed() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const profile = await getCurrentUser();
  if (!profile) redirect("/login");

  if (profile.mfa_method === "totp") {
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!aal) redirect("/login");

    if (aal.currentLevel === "aal1" && aal.nextLevel === "aal2") {
      redirect("/login/totp");
    }
    if (aal.currentLevel === "aal1" && aal.nextLevel === "aal1") {
      redirect("/onboarding/method");
    }
    return profile;
  }

  // mfa_method === 'email'
  const passed = await verifyEmail2faCookie(profile.id);
  if (!passed) redirect("/login/email");
  return profile;
}

export async function requireRole(role: Role | Role[]) {
  const user = await requireFullyAuthed();
  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(user.role)) redirect(`/dashboard/${user.role}`);
  return user;
}
