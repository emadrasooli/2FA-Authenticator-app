import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAuthenticationOptions } from "@/lib/auth/webauthn";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const options = await buildAuthenticationOptions({ userId: user.id });
    return NextResponse.json(options);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}
