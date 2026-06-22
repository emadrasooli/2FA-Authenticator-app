"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  next: z.string().optional(),
});

export type LoginState = { error?: string } | undefined;

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: "Invalid email or password format" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
  if (error || !data.user) return { error: "Invalid credentials" };

  // Look up the user's chosen 2FA method.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("mfa_method")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profile?.mfa_method === "email") {
    redirect("/login/email");
  }

  // Default to TOTP for everyone else (including freshly-seeded admins
  // whose mfa_method is the column default).
  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel === "aal1") {
    redirect("/login/totp");
  }
  redirect("/onboarding/method");
}
