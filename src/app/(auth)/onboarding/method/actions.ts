"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { issueEmail2faCookie } from "@/lib/auth/email-2fa-session";

const ChooseSchema = z.object({ method: z.enum(["totp", "email"]) });

export type ChooseMethodState = { error?: string } | undefined;

export async function chooseMethodAction(
  _prev: ChooseMethodState,
  formData: FormData,
): Promise<ChooseMethodState> {
  const parsed = ChooseSchema.safeParse({ method: formData.get("method") });
  if (!parsed.success) return { error: "Invalid choice." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ mfa_method: parsed.data.method })
    .eq("id", user.id);

  if (parsed.data.method === "totp") {
    redirect("/onboarding/totp");
  }

  // Email method: invite already proves they own the inbox, so promote the
  // session to passed-2FA without sending another code.
  await issueEmail2faCookie(user.id);

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  redirect(`/dashboard/${profile?.role ?? "student"}`);
}
