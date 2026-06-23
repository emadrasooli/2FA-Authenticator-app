import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clearEmail2faCookie } from "@/lib/auth/email-2fa-session";
import { clearPasskey2faCookie } from "@/lib/auth/passkey-2fa-session";

export async function POST() {
  // Clear our own AAL cookies first — independent of whether Supabase has a
  // session, so it must not be skipped if signOut() errors.
  await clearEmail2faCookie();
  await clearPasskey2faCookie();

  const supabase = await createClient();
  await supabase.auth.signOut().catch(() => {
    // If the client cleared cookies first there may be no session here.
  });

  return NextResponse.json({ ok: true });
}
