"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

const Schema = z.object({ email: z.string().email() });

export type ForgotPasswordState = { error?: string } | undefined;

export async function requestPasswordResetAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = Schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Enter a valid email." };

  const supabase = await createClient();
  // We don't await/inspect the result strictly — Supabase deliberately
  // returns ok even for non-existent emails to avoid user enumeration.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.APP_URL}/auth/callback?next=/reset-password`,
  });

  redirect(
    `/forgot-password?sent=1&email=${encodeURIComponent(parsed.data.email)}`,
  );
}
