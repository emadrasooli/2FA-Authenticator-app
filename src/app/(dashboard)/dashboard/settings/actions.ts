"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireFullyAuthed, getMfaConfig } from "@/lib/auth/rbac";
import { clearEmail2faCookie } from "@/lib/auth/email-2fa-session";

const MethodSchema = z.object({ method: z.enum(["totp", "email"]) });

export type SettingsState =
  | { error?: string; success?: string }
  | undefined;

/** Toggle the email-code factor on/off. Must keep at least one method enabled. */
export async function toggleEmailMethodAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireFullyAuthed();
  const want = formData.get("enabled") === "true";

  const config = await getMfaConfig();
  if (!config) return { error: "Could not load your settings." };

  if (!want && !config.totpEnabled) {
    return { error: "Set up the authenticator app first — you need at least one method." };
  }

  const admin = createAdminClient();
  const patch: Record<string, unknown> = { email_2fa_enabled: want };
  // If disabling and the preferred method was email, fall back to totp.
  if (!want && config.preferred === "email") patch.mfa_method = "totp";
  await admin.from("profiles").update(patch).eq("id", user.id);

  // If we just disabled email, drop any active email-AAL2 cookie so a stale
  // signal doesn't satisfy hasPassedSecondFactor on subsequent loads.
  if (!want) await clearEmail2faCookie();

  revalidatePath("/dashboard/settings");
  return { success: want ? "Email code enabled." : "Email code disabled." };
}

/** Remove the TOTP factor. Email must be enabled (it can't drop to zero methods). */
export async function removeAuthenticatorAction(
  _prev: SettingsState,
  _formData: FormData,
): Promise<SettingsState> {
  const user = await requireFullyAuthed();
  const config = await getMfaConfig();
  if (!config) return { error: "Could not load your settings." };

  if (!config.emailEnabled) {
    return { error: "Enable email code first — you need at least one method." };
  }

  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.totp ?? []) {
    await admin.auth.admin.mfa.deleteFactor({ userId: user.id, id: f.id });
  }

  if (config.preferred === "totp") {
    await admin
      .from("profiles")
      .update({ mfa_method: "email" })
      .eq("id", user.id);
  }

  revalidatePath("/dashboard/settings");
  return { success: "Authenticator removed." };
}

/** Set which method is the default at login when both are enabled. */
export async function setPreferredMethodAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireFullyAuthed();
  const parsed = MethodSchema.safeParse({ method: formData.get("method") });
  if (!parsed.success) return { error: "Invalid choice." };

  const config = await getMfaConfig();
  if (!config) return { error: "Could not load your settings." };

  // Picking a default that isn't enabled doesn't make sense; route to setup.
  if (parsed.data.method === "totp" && !config.totpEnabled) {
    redirect("/dashboard/settings/authenticator?primary=1");
  }
  if (parsed.data.method === "email" && !config.emailEnabled) {
    return { error: "Enable email code first." };
  }

  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ mfa_method: parsed.data.method })
    .eq("id", user.id);

  revalidatePath("/dashboard/settings");
  return { success: "Default updated." };
}
