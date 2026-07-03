import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";
import { verifyAndStoreRegistration } from "@/lib/auth/webauthn";
import { issueAal2Cookie } from "@/lib/auth/aal-cookie";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: {
    response: RegistrationResponseJSON;
    deviceName?: string;
    makePreferred?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    await verifyAndStoreRegistration({
      userId: user.id,
      response: body.response,
      deviceName: body.deviceName,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Verification failed" },
      { status: 400 },
    );
  }

  // Registering a passkey logged-in equals proving the second factor right now.
  await issueAal2Cookie("passkey", user.id);

  if (body.makePreferred) {
    const admin = createAdminClient();
    await admin
      .from("profiles")
      .update({ mfa_method: "passkey" })
      .eq("id", user.id);
  }

  return NextResponse.json({ ok: true });
}
