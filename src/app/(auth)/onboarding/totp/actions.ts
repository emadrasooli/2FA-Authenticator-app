"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const VerifySchema = z.object({
  factorId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/u, "Code must be 6 digits"),
});

export type EnrollState = { error?: string } | undefined;

export async function verifyEnrollmentAction(
  _prev: EnrollState,
  formData: FormData,
): Promise<EnrollState> {
  const parsed = VerifySchema.safeParse({
    factorId: formData.get("factorId"),
    code: formData.get("code"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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
    return { error: "Incorrect code. Try again." };
  }

  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ mfa_method: "totp" })
    .eq("id", user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  redirect(`/dashboard/${profile?.role ?? "student"}`);
}
