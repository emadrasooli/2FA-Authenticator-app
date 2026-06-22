"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireFullyAuthed } from "@/lib/auth/rbac";

const MethodSchema = z.object({ method: z.enum(["totp", "email"]) });

export type SettingsState =
  | { error?: string; success?: string }
  | undefined;

export async function setPrimaryMethodAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireFullyAuthed();
  const parsed = MethodSchema.safeParse({ method: formData.get("method") });
  if (!parsed.success) return { error: "Invalid choice." };

  // Choosing authenticator as primary requires an enrolled factor.
  if (parsed.data.method === "totp") {
    const supabase = await createClient();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    if ((factors?.totp?.length ?? 0) === 0) {
      redirect("/dashboard/settings/authenticator?primary=1");
    }
  }

  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ mfa_method: parsed.data.method })
    .eq("id", user.id);

  revalidatePath("/dashboard/settings");
  return { success: "Primary method updated." };
}

export async function removeAuthenticatorAction(
  _prev: SettingsState,
  _formData: FormData,
): Promise<SettingsState> {
  const user = await requireFullyAuthed();
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.totp ?? []) {
    await admin.auth.admin.mfa.deleteFactor({ userId: user.id, id: f.id });
  }

  // If the authenticator was the primary method, fall back to email.
  if (user.mfa_method === "totp") {
    await admin
      .from("profiles")
      .update({ mfa_method: "email" })
      .eq("id", user.id);
  }

  revalidatePath("/dashboard/settings");
  return { success: "Authenticator removed. Email code is now your method." };
}
