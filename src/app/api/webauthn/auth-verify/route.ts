import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";
import { verifyAuthentication } from "@/lib/auth/webauthn";
import { issuePasskey2faCookie } from "@/lib/auth/passkey-2fa-session";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: { response: AuthenticationResponseJSON };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    await verifyAuthentication({ userId: user.id, response: body.response });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Verification failed" },
      { status: 400 },
    );
  }

  await issuePasskey2faCookie(user.id);
  return NextResponse.json({ ok: true });
}
