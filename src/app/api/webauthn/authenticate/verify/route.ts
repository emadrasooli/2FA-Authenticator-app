import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyAuthentication } from "@/lib/webauthn";
import { markPasskeyVerified } from "@/lib/auth/session";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { response?: unknown }
    | null;
  if (!body?.response) {
    return NextResponse.json({ error: "Missing response" }, { status: 400 });
  }

  try {
    await verifyAuthentication({
      userId: user.id,
      response: body.response as Parameters<typeof verifyAuthentication>[0]["response"],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 400 },
    );
  }

  await markPasskeyVerified(user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    redirectTo: `/dashboard/${profile?.role ?? "student"}`,
  });
}
