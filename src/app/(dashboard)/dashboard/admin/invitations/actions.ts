"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireRole } from "@/lib/auth/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { inviteEmailTemplate, sendEmail } from "@/lib/email";

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "teacher", "student"]),
});

export type InviteState =
  | { error?: string; success?: string; warning?: string }
  | undefined;

export async function createInviteAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const me = await requireRole("admin");

  const parsed = InviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: "Please provide a valid email and role." };

  const token = randomBytes(24).toString("base64url");
  const admin = createAdminClient();
  const { error } = await admin.from("invitations").insert({
    email: parsed.data.email,
    role: parsed.data.role,
    token,
    invited_by: me.id,
  });
  if (error) return { error: error.message };

  const link = `${env.APP_URL}/signup?token=${token}`;
  const tpl = inviteEmailTemplate({
    link,
    role: parsed.data.role,
    inviter: me.full_name,
  });
  const result = await sendEmail({
    to: parsed.data.email,
    subject: "You're invited to the University Portal",
    html: tpl.html,
    text: tpl.text,
  });

  revalidatePath("/dashboard/admin/invitations");

  if (!result.sent) {
    if (result.reason === "not-configured") {
      return {
        success: `Invite created for ${parsed.data.email}.`,
        warning:
          "Email sending is not configured (RESEND_API_KEY / RESEND_FROM missing). Copy the invite link from the list below and share it manually.",
      };
    }
    return {
      success: `Invite created for ${parsed.data.email}.`,
      warning: `Email send failed: ${result.error}. Copy the link below and share it manually.`,
    };
  }

  return { success: `Invite emailed to ${parsed.data.email}.` };
}
