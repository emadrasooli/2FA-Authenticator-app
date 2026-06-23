import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clearEmail2faCookie } from "@/lib/auth/email-2fa-session";

export async function POST() {
  // Always clear the email_2fa cookie first — this is independent of whether
  // Supabase has a session, so it must not be skipped if signOut() errors.
  await clearEmail2faCookie();

  const supabase = await createClient();
  await supabase.auth.signOut().catch(() => {
    // If the client cleared cookies first there may be no session here; that's
    // fine — the local cookies were already removed by the browser.
  });

  return NextResponse.json({ ok: true });
}
