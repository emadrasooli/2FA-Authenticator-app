"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { issueAal2Cookie } from "@/lib/auth/aal-cookie";
import { issueEmailOtp, verifyEmailOtp } from "@/lib/auth/email-otp";

const CodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/u, "Code must be 6 digits"),
});

export type EmailCodeState = { error?: string; info?: string } | undefined;

export async function verifyEmailCodeAction(
  _prev: EmailCodeState,
  formData: FormData,
): Promise<EmailCodeState> {
  const parsed = CodeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid code" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const result = await verifyEmailOtp({
    userId: user.id,
    code: parsed.data.code,
  });
  if (!result.ok) {
    const messages: Record<typeof result.reason, string> = {
      "no-challenge": "No active code. Click Resend.",
      expired: "Code has expired. Click Resend.",
      "too-many-attempts": "Too many tries. Click Resend to get a new code.",
      mismatch: "Incorrect code. Try again.",
    };
    return { error: messages[result.reason] };
  }

  await issueAal2Cookie("email", user.id);

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  redirect(`/dashboard/${profile?.role ?? "student"}`);
}

export async function resendEmailCodeAction(
  _prev: EmailCodeState,
  _formData: FormData,
): Promise<EmailCodeState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/login");

  const result = await issueEmailOtp({
    userId: user.id,
    email: profile.email,
  });
  if (!result.ok) {
    return {
      error:
        result.reason === "not-configured"
          ? "Email sending is not configured."
          : "Could not send the code. Try again.",
    };
  }
  return { info: "A new code is on its way." };
}
