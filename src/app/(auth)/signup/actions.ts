"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const SignupSchema = z.object({
  token: z.string().min(8),
  fullName: z.string().min(2).max(120),
  password: z.string().min(8).max(128),
});

export type SignupState = { error?: string } | undefined;

export async function signupAction(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const parsed = SignupSchema.safeParse({
    token: formData.get("token"),
    fullName: formData.get("fullName"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Please check your inputs." };

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("invitations")
    .select("id, email, role, expires_at, used_at")
    .eq("token", parsed.data.token)
    .maybeSingle();

  if (!invite) return { error: "Invalid invite token." };
  if (invite.used_at) return { error: "This invite has already been used." };
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return { error: "This invite has expired." };
  }

  // Create the auth user with email auto-confirmed (the invite proves email control).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: invite.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName, role: invite.role },
  });
  if (createErr || !created.user) {
    return { error: createErr?.message ?? "Could not create account." };
  }

  const { error: profileErr } = await admin.from("profiles").insert({
    id: created.user.id,
    full_name: parsed.data.fullName,
    email: invite.email,
    role: invite.role,
  });
  if (profileErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: "Could not create profile. Try again." };
  }

  await admin
    .from("invitations")
    .update({ used_at: new Date().toISOString() })
    .eq("id", invite.id);

  // Sign in immediately so the next step (passkey enrollment) has a session.
  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: invite.email,
    password: parsed.data.password,
  });
  if (signInErr) {
    return { error: "Account created — please sign in." };
  }

  redirect("/onboarding/totp");
}
