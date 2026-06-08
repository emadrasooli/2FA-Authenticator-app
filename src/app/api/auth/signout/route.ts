import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clearAal2Cookie } from "@/lib/auth/session";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await clearAal2Cookie();
  return NextResponse.json({ ok: true });
}
