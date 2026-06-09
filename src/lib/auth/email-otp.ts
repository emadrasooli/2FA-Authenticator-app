import "server-only";

import { createHash, randomInt } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
  // 6-digit numeric, leading zeros preserved.
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function template(code: string) {
  const text = `Your University Portal verification code is: ${code}

It expires in 10 minutes. If you didn't request this, you can ignore the email.`;

  const html = `<!doctype html><html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width:520px; margin:0 auto; padding:24px; color:#111;">
  <h2 style="margin:0 0 12px;">Your verification code</h2>
  <p style="margin:0 0 16px; color:#555;">Use this code to finish signing in. It expires in 10 minutes.</p>
  <p style="font-size:32px; letter-spacing:6px; font-weight:700; background:#f3f4f6; padding:14px 0; text-align:center; border-radius:8px; font-family: ui-monospace, monospace;">${code}</p>
  <p style="margin:24px 0 0; color:#888; font-size:13px;">If you didn't request this, ignore the email.</p>
</body></html>`;

  return { html, text };
}

export type IssueResult =
  | { ok: true }
  | { ok: false; reason: "send-failed" | "not-configured"; error?: string };

export async function issueEmailOtp(opts: {
  userId: string;
  email: string;
}): Promise<IssueResult> {
  const code = generateCode();
  const admin = createAdminClient();

  // Invalidate any pending challenges for this user.
  await admin
    .from("email_otp_challenges")
    .delete()
    .eq("user_id", opts.userId)
    .is("consumed_at", null);

  await admin.from("email_otp_challenges").insert({
    user_id: opts.userId,
    code_hash: hashCode(code),
  });

  const tpl = template(code);
  const result = await sendEmail({
    to: opts.email,
    subject: "Your University Portal verification code",
    html: tpl.html,
    text: tpl.text,
  });

  if (!result.sent) {
    return { ok: false, reason: result.reason, error: result.error };
  }
  return { ok: true };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "no-challenge" | "expired" | "too-many-attempts" | "mismatch" };

export async function verifyEmailOtp(opts: {
  userId: string;
  code: string;
}): Promise<VerifyResult> {
  const admin = createAdminClient();
  const { data: challenge } = await admin
    .from("email_otp_challenges")
    .select("id, code_hash, attempts, expires_at, consumed_at")
    .eq("user_id", opts.userId)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!challenge) return { ok: false, reason: "no-challenge" };
  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    return { ok: false, reason: "too-many-attempts" };
  }

  if (hashCode(opts.code) !== challenge.code_hash) {
    await admin
      .from("email_otp_challenges")
      .update({ attempts: challenge.attempts + 1 })
      .eq("id", challenge.id);
    return { ok: false, reason: "mismatch" };
  }

  await admin
    .from("email_otp_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", challenge.id);
  return { ok: true };
}
