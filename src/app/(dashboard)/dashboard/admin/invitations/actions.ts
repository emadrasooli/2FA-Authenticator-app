"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireRole } from "@/lib/auth/rbac";
import { createAdminClient } from "@/lib/supabase/admin";

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "teacher", "student"]),
});

export type InviteState =
  | { error?: string; success?: string }
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

  revalidatePath("/dashboard/admin/invitations");
  return { success: `Invite created for ${parsed.data.email}.` };
}
