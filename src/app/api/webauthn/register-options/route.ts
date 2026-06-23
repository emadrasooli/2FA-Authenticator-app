import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildRegistrationOptions } from "@/lib/auth/webauthn";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .maybeSingle();

  try {
    const options = await buildRegistrationOptions({
      userId: user.id,
      userName: profile?.email ?? user.email ?? user.id,
    });
    return NextResponse.json(options);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
