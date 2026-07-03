import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * A signed, HttpOnly cookie that records the current session has cleared a
 * particular second-factor method. Used for the "email code" and "passkey"
 * methods (TOTP uses Supabase's native AAL2 instead of a cookie).
 *
 * Payload format: `<userId>.<expiryMs>.<nonce>.<hmac>` where the HMAC is over
 * the first three parts, keyed by the service-role secret. The nonce keeps two
 * concurrent sessions from producing identical cookie values.
 */
export type Aal2Method = "email" | "passkey";

const COOKIE_NAME: Record<Aal2Method, string> = {
  email: "email_2fa",
  passkey: "passkey_2fa",
};
const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function secret(): string {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY required to sign AAL2 cookies");
  }
  return env.SUPABASE_SERVICE_ROLE_KEY;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export async function issueAal2Cookie(method: Aal2Method, userId: string) {
  const exp = Date.now() + TTL_MS;
  const nonce = randomBytes(16).toString("base64url");
  const payload = `${userId}.${exp}.${nonce}`;
  const value = `${payload}.${sign(payload)}`;

  const jar = await cookies();
  jar.set(COOKIE_NAME[method], value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function verifyAal2Cookie(
  method: Aal2Method,
  userId: string,
): Promise<boolean> {
  const jar = await cookies();
  const value = jar.get(COOKIE_NAME[method])?.value;
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

export async function clearAal2Cookie(method: Aal2Method) {
  const jar = await cookies();
  jar.delete(COOKIE_NAME[method]);
}
