import "server-only";

import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const COOKIE_NAME = "aal2_session";
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

function newSessionId() {
  return randomBytes(32).toString("hex");
}

export async function getOrCreateAal2Session(userId: string) {
  const jar = await cookies();
  let sid = jar.get(COOKIE_NAME)?.value;
  const admin = createAdminClient();

  if (sid) {
    const { data } = await admin
      .from("auth_sessions")
      .select("session_id, user_id, aal2_passkey, expires_at")
      .eq("session_id", sid)
      .maybeSingle();
    if (
      data &&
      data.user_id === userId &&
      new Date(data.expires_at).getTime() > Date.now()
    ) {
      return data;
    }
  }

  sid = newSessionId();
  const expiresAt = new Date(Date.now() + TWELVE_HOURS_MS).toISOString();
  await admin.from("auth_sessions").insert({
    session_id: sid,
    user_id: userId,
    aal2_passkey: false,
    expires_at: expiresAt,
  });
  jar.set(COOKIE_NAME, sid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TWELVE_HOURS_MS / 1000,
  });
  return {
    session_id: sid,
    user_id: userId,
    aal2_passkey: false,
    expires_at: expiresAt,
  };
}

export async function markPasskeyVerified(userId: string) {
  const session = await getOrCreateAal2Session(userId);
  const admin = createAdminClient();
  await admin
    .from("auth_sessions")
    .update({ aal2_passkey: true })
    .eq("session_id", session.session_id);
}

export async function isPasskeyVerified(userId: string): Promise<boolean> {
  const jar = await cookies();
  const sid = jar.get(COOKIE_NAME)?.value;
  if (!sid) return false;
  const admin = createAdminClient();
  const { data } = await admin
    .from("auth_sessions")
    .select("user_id, aal2_passkey, expires_at")
    .eq("session_id", sid)
    .maybeSingle();
  if (!data) return false;
  if (data.user_id !== userId) return false;
  if (new Date(data.expires_at).getTime() <= Date.now()) return false;
  return data.aal2_passkey === true;
}

export async function clearAal2Cookie() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
