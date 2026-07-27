import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = new Set<EmailOtpType>([
  "email",
  "recovery",
  "invite",
  "magiclink",
  "email_change",
]);

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  return value;
}

/**
 * Verifies token-hash links from Supabase email templates.
 *
 * Unlike exchangeCodeForSession(), verifyOtp() does not depend on a PKCE
 * verifier left in the browser that requested the email. Recovery links
 * therefore also work when opened in another browser or on another device.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  if (!tokenHash || !type || !ALLOWED_TYPES.has(type)) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("This email link is invalid.")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        "This email link is invalid or has expired. Request a new one.",
      )}`,
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
