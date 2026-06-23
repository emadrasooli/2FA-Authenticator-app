"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const VerifySchema = z.object({
  factorId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/u, "Code must be 6 digits"),
});

export type LoginTotpState = { error?: string } | undefined;

export async function verifyLoginTotpAction(
  _prev: LoginTotpState,
  formData: FormData,
): Promise<LoginTotpState> {
  const parsed = VerifySchema.safeParse({
    factorId: formData.get("factorId"),
    code: formData.get("code"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  // Authenticate the session before any MFA call (silences supabase-js
  // insecure-session warnings).
  const {
    data: { user: authedUser },
  } = await supabase.auth.getUser();
  if (!authedUser) redirect("/login");

  const { data: challenge, error: challengeErr } =
    await supabase.auth.mfa.challenge({ factorId: parsed.data.factorId });
  if (challengeErr || !challenge) {
    return { error: challengeErr?.message ?? "Could not start challenge" };
  }

  const { error: verifyErr } = await supabase.auth.mfa.verify({
    factorId: parsed.data.factorId,
    challengeId: challenge.id,
    code: parsed.data.code,
  });
  if (verifyErr) {
    return { error: "Incorrect or expired code. Try again." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authedUser.id)
    .maybeSingle();
  redirect(`/dashboard/${profile?.role ?? "student"}`);
}
