import "server-only";

import { Resend } from "resend";

type SendInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailResult =
  | { sent: true }
  | { sent: false; reason: "not-configured" | "send-failed"; error?: string };

function isConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

export async function sendEmail(input: SendInput): Promise<EmailResult> {
  if (!isConfigured()) {
    return { sent: false, reason: "not-configured" };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM!;

  const { error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  if (error) {
    return {
      sent: false,
      reason: "send-failed",
      error: error.message ?? String(error),
    };
  }
  return { sent: true };
}

export function inviteEmailTemplate(opts: {
  link: string;
  role: string;
  inviter?: string;
}) {
  const role = opts.role[0].toUpperCase() + opts.role.slice(1);
  const inviter = opts.inviter ?? "an administrator";

  const text = `You have been invited to join the University Portal as a ${role}.

Click this link to set up your account (valid for 7 days):
${opts.link}

If you weren't expecting this, you can ignore this email.`;

  const html = `<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #111; max-width: 560px; margin: 0 auto; padding: 24px;">
    <h2 style="margin: 0 0 16px;">You're invited to the University Portal</h2>
    <p style="margin: 0 0 16px;">
      ${escapeHtml(inviter)} has invited you to join as a <strong>${escapeHtml(role)}</strong>.
    </p>
    <p style="margin: 0 0 24px;">
      <a href="${opts.link}"
         style="display:inline-block; background:#2563eb; color:#fff; padding:10px 18px; border-radius:6px; text-decoration:none; font-weight:600;">
        Set up your account
      </a>
    </p>
    <p style="margin: 0 0 8px; color:#555; font-size: 14px;">
      Or copy this link into your browser:
    </p>
    <p style="margin: 0 0 16px; word-break: break-all; font-family: ui-monospace, monospace; font-size: 13px; color:#444;">
      ${escapeHtml(opts.link)}
    </p>
    <p style="margin: 24px 0 0; color:#777; font-size: 13px;">
      This link expires in 7 days. If you weren't expecting this invitation, ignore this email.
    </p>
  </body>
</html>`;

  return { html, text };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
