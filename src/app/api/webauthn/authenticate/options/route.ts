import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAuthenticationOptions } from "@/lib/webauthn";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const options = await buildAuthenticationOptions({ userId: user.id });
  return NextResponse.json(options);
}
