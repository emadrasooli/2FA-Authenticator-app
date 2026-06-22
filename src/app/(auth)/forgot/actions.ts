"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const RequestSchema = z.object({ email: z.string().email() });

export type ForgotState = { error?: string } | undefined;

export async function requestRecoveryAction(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const parsed = RequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Enter a valid email." };

  const supabase = await createClient();
  await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: false },
  });

  // Don't leak whether the email exists — always redirect to "sent" state.
  redirect(`/forgot/verify?email=${encodeURIComponent(parsed.data.email)}`);
}

const VerifySchema = z.object({
  email: z.string().email(),
  token: z.string().regex(/^\d{6,8}$/u, "Enter the code from your email"),
});

export async function verifyRecoveryAction(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const parsed = VerifySchema.safeParse({
    email: formData.get("email"),
    token: formData.get("token"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "email",
  });
  if (error || !data.user) {
    return { error: "Incorrect or expired code." };
  }

  // Wipe any existing TOTP factor so the user can enroll a new one.
  const admin = createAdminClient();
  const { data: factorList } = await admin.auth.admin.mfa.listFactors({
    userId: data.user.id,
  });
  for (const f of factorList?.factors ?? []) {
    if (f.factor_type === "totp") {
      await admin.auth.admin.mfa.deleteFactor({
        userId: data.user.id,
        id: f.id,
      });
    }
  }

  redirect("/onboarding/totp");
}
