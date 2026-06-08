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

  // Check if user has any passkey
  const admin = createAdminClient();
  const { count } = await admin
    .from("webauthn_credentials")
    .select("id", { count: "exact", head: true })
    .eq("user_id", data.user.id);

  // No passkey enrolled yet → force onboarding (verified by email link / first login).
  if ((count ?? 0) === 0) {
    redirect("/onboarding/passkey");
  }

  const nextPath = parsed.data.next && parsed.data.next.startsWith("/")
    ? parsed.data.next
    : "/login/passkey";
  redirect(nextPath === "/login/passkey" ? "/login/passkey" : "/login/passkey?next=" + encodeURIComponent(nextPath));
}
