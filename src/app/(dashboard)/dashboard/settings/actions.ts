"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireFullyAuthed, getMfaConfig } from "@/lib/auth/rbac";
import { clearEmail2faCookie } from "@/lib/auth/email-2fa-session";
import { clearPasskey2faCookie } from "@/lib/auth/passkey-2fa-session";
import { deleteAllUserCredentials } from "@/lib/auth/webauthn";

const MethodSchema = z.object({ method: z.enum(["totp", "email", "passkey"]) });

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

  if (!want && !config.totpEnabled && !config.passkeyEnabled) {
    return { error: "Enable another method first — you need at least one." };
  }

  const admin = createAdminClient();
  const patch: Record<string, unknown> = { email_2fa_enabled: want };
  if (!want && config.preferred === "email") {
    patch.mfa_method = config.totpEnabled ? "totp" : "passkey";
  }
  await admin.from("profiles").update(patch).eq("id", user.id);

  if (!want) await clearEmail2faCookie();

  revalidatePath("/dashboard/settings");
  return { success: want ? "Email code enabled." : "Email code disabled." };
}

/** Remove the TOTP factor. Must keep at least one method enabled. */
export async function removeAuthenticatorAction(
  _prev: SettingsState,
  _formData: FormData,
): Promise<SettingsState> {
  const user = await requireFullyAuthed();
  const config = await getMfaConfig();
  if (!config) return { error: "Could not load your settings." };

  if (!config.emailEnabled && !config.passkeyEnabled) {
    return { error: "Enable another method first — you need at least one." };
  }

  const supabase = await createClient();
  await supabase.auth.getUser();
  const admin = createAdminClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.totp ?? []) {
    await admin.auth.admin.mfa.deleteFactor({ userId: user.id, id: f.id });
  }

  if (config.preferred === "totp") {
    await admin
      .from("profiles")
      .update({ mfa_method: config.passkeyEnabled ? "passkey" : "email" })
      .eq("id", user.id);
  }

  revalidatePath("/dashboard/settings");
  return { success: "Authenticator removed." };
}

/** Remove all passkeys. Must keep at least one method enabled. */
export async function removePasskeyAction(
  _prev: SettingsState,
  _formData: FormData,
): Promise<SettingsState> {
  const user = await requireFullyAuthed();
  const config = await getMfaConfig();
  if (!config) return { error: "Could not load your settings." };

  if (!config.emailEnabled && !config.totpEnabled) {
    return { error: "Enable another method first — you need at least one." };
  }

  await deleteAllUserCredentials(user.id);
  await clearPasskey2faCookie();

  if (config.preferred === "passkey") {
    const admin = createAdminClient();
    await admin
      .from("profiles")
      .update({ mfa_method: config.totpEnabled ? "totp" : "email" })
      .eq("id", user.id);
  }

  revalidatePath("/dashboard/settings");
  return { success: "Passkey removed." };
}

/** Set the default method to highlight first at login. */
export async function setPreferredMethodAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireFullyAuthed();
  const parsed = MethodSchema.safeParse({ method: formData.get("method") });
  if (!parsed.success) return { error: "Invalid choice." };

  const config = await getMfaConfig();
  if (!config) return { error: "Could not load your settings." };

  if (parsed.data.method === "totp" && !config.totpEnabled) {
    redirect("/dashboard/settings/authenticator?primary=1");
  }
  if (parsed.data.method === "passkey" && !config.passkeyEnabled) {
    redirect("/dashboard/settings/passkey?primary=1");
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
