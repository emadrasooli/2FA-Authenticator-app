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

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("mfa_method, email_2fa_enabled")
    .eq("id", data.user.id)
    .maybeSingle();

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totpEnabled = (factors?.totp?.length ?? 0) > 0;
  const emailEnabled = profile?.email_2fa_enabled ?? true;

  if (!totpEnabled && !emailEnabled) redirect("/onboarding/method");
  if (totpEnabled && emailEnabled) redirect("/login/choose");
  if (totpEnabled) redirect("/login/totp");
  redirect("/login/email");
}
