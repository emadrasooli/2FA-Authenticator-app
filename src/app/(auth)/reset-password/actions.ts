"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { clearEmail2faCookie } from "@/lib/auth/email-2fa-session";

const Schema = z
  .object({
    password: z.string().min(8).max(128),
    confirm: z.string().min(8).max(128),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match.",
    path: ["confirm"],
  });

export type ResetPasswordState = { error?: string } | undefined;

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = Schema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { error: error.message };

  // Force a full re-auth: sign out, drop any prior MFA cookie, then send
  // the user back to /login to authenticate with the new password and
  // re-pass the 2FA challenge.
  await supabase.auth.signOut();
  await clearEmail2faCookie();

  redirect("/login?reset=ok");
}
