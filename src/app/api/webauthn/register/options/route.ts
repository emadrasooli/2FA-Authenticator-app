import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildRegistrationOptions } from "@/lib/webauthn";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const options = await buildRegistrationOptions({
    userId: user.id,
    userName: profile?.email ?? user.email ?? user.id,
    displayName: profile?.full_name ?? "User",
  });

  return NextResponse.json(options);
}
