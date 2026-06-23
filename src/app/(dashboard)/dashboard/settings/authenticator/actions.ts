"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireFullyAuthed } from "@/lib/auth/rbac";

const VerifySchema = z.object({
  factorId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/u, "Code must be 6 digits"),
  makePrimary: z.string().optional(),
});

export type EnrollState = { error?: string } | undefined;

export async function verifySettingsEnrollmentAction(
  _prev: EnrollState,
  formData: FormData,
): Promise<EnrollState> {
  const user = await requireFullyAuthed();
  const parsed = VerifySchema.safeParse({
    factorId: formData.get("factorId"),
    code: formData.get("code"),
    makePrimary: formData.get("makePrimary") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  // Authenticate before any MFA call.
  await supabase.auth.getUser();

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
  if (verifyErr) return { error: "Incorrect code. Try again." };

  // If the user reached here via "make authenticator my primary method",
  // flip the preference now that a factor exists.
  if (parsed.data.makePrimary === "1") {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    await admin
      .from("profiles")
      .update({ mfa_method: "totp" })
      .eq("id", user.id);
  }

  redirect("/dashboard/settings");
}
