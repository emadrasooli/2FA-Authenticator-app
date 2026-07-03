import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clearAal2Cookie } from "@/lib/auth/aal-cookie";

export async function POST() {
  // Clear our own AAL cookies first — independent of whether Supabase has a
  // session, so it must not be skipped if signOut() errors.
  await clearAal2Cookie("email");
  await clearAal2Cookie("passkey");

  const supabase = await createClient();
  await supabase.auth.signOut().catch(() => {
    // If the client cleared cookies first there may be no session here.
  });

  return NextResponse.json({ ok: true });
}
