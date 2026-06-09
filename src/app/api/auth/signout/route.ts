import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clearEmail2faCookie } from "@/lib/auth/email-2fa-session";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await clearEmail2faCookie();
  return NextResponse.json({ ok: true });
}
