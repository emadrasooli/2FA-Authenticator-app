import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPasskeyVerified } from "@/lib/auth/session";

export type Role = "admin" | "teacher" | "student";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("id", user.id)
    .maybeSingle();
  return profile ? { ...profile, role: profile.role as Role } : null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireFullyAuthed() {
  const user = await requireUser();
  const verified = await isPasskeyVerified(user.id);
  if (!verified) redirect("/login/passkey");
  return user;
}

export async function requireRole(role: Role | Role[]) {
  const user = await requireFullyAuthed();
  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(user.role)) redirect(`/dashboard/${user.role}`);
  return user;
}
