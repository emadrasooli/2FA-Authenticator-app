import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

const COOKIE_NAME = "email_2fa";
const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function secret(): string {
  // Service-role key is server-only and never rotates unless the admin does it
  // deliberately. Good enough as the HMAC key for short-lived MFA cookies.
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY required for email-2fa cookie");
  }
  return env.SUPABASE_SERVICE_ROLE_KEY;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export async function issueEmail2faCookie(userId: string) {
  const exp = Date.now() + TTL_MS;
  const nonce = randomBytes(16).toString("base64url");
  const payload = `${userId}.${exp}.${nonce}`;
  const sig = sign(payload);
  const value = `${payload}.${sig}`;

  const jar = await cookies();
  jar.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function verifyEmail2faCookie(userId: string): Promise<boolean> {
  const jar = await cookies();
  const value = jar.get(COOKIE_NAME)?.value;
  if (!value) return false;

  const parts = value.split(".");
  if (parts.length !== 4) return false;
  const [cookieUser, expStr, nonce, sig] = parts;
  if (cookieUser !== userId) return false;

  const expected = sign(`${cookieUser}.${expStr}.${nonce}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Date.now()) return false;

  return true;
}

export async function clearEmail2faCookie() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
