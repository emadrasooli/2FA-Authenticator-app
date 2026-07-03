import "server-only";

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

type ChallengePurpose = "register" | "authenticate";

const CHALLENGE_TTL_MS = 10 * 60 * 1000; // 10 minutes

type ConsumeResult =
  | { challenge: string }
  | { challenge: null; reason: "none" | "expired" };

async function persistChallenge(opts: {
  userId: string;
  challenge: string;
  purpose: ChallengePurpose;
}) {
  const admin = createAdminClient();
  // Compute expires_at in THIS process's clock (not the DB's) and compare it
  // against the same clock on read. This makes the challenge lifetime immune
  // to clock skew between the app server and the Postgres server.
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
  const { error } = await admin.from("webauthn_challenges").insert({
    user_id: opts.userId,
    challenge: opts.challenge,
    purpose: opts.purpose,
    expires_at: expiresAt,
  });
  if (error) {
    // Surface the real cause (missing table, RLS, etc.) instead of letting the
    // options endpoint succeed and the later verify fail with a cryptic
    // "No active registration challenge".
    throw new Error(`Could not store WebAuthn challenge: ${error.message}`);
  }
}

async function consumeChallenge(opts: {
  userId: string;
  purpose: ChallengePurpose;
}): Promise<ConsumeResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("webauthn_challenges")
    .select("id, challenge, expires_at, consumed_at")
    .eq("user_id", opts.userId)
    .eq("purpose", opts.purpose)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`Could not read WebAuthn challenge: ${error.message}`);
  }
  if (!data) return { challenge: null, reason: "none" };
  // Always consume (single-use) even if expired, so a stale row can't linger.
  await admin
    .from("webauthn_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", data.id);
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    return { challenge: null, reason: "expired" };
  }
  return { challenge: data.challenge };
}

export async function listUserCredentials(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("webauthn_credentials")
    .select("id, credential_id, public_key, counter, transports, device_name, created_at, last_used_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function buildRegistrationOptions(opts: {
  userId: string;
  userName: string;
}) {
  const existing = await listUserCredentials(opts.userId);

  const options = await generateRegistrationOptions({
    rpName: env.RP_NAME,
    rpID: env.RP_ID,
    userName: opts.userName,
    userID: Buffer.from(opts.userId),
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: c.credential_id,
      transports: (c.transports ?? []) as AuthenticatorTransport[],
    })),
    authenticatorSelection: {
      // "platform" → built-in like Windows Hello / Touch ID. We allow either
      // platform or cross-platform (security keys) by leaving this unset.
      residentKey: "preferred",
      userVerification: "required",
    },
  });

  await persistChallenge({
    userId: opts.userId,
    challenge: options.challenge,
    purpose: "register",
  });

  return options;
}

export async function verifyAndStoreRegistration(opts: {
  userId: string;
  response: RegistrationResponseJSON;
  deviceName?: string;
}) {
  const consumed = await consumeChallenge({
    userId: opts.userId,
    purpose: "register",
  });
  if (consumed.challenge === null) {
    throw new Error(
      consumed.reason === "expired"
        ? "Registration challenge expired. Please try again."
        : "No registration challenge found. Please start again.",
    );
  }

  const verification = await verifyRegistrationResponse({
    response: opts.response,
    expectedChallenge: consumed.challenge,
    expectedOrigin: env.RP_ORIGIN,
    expectedRPID: env.RP_ID,
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Registration verification failed");
  }

  const { credential } = verification.registrationInfo;

  const admin = createAdminClient();
  const { error: insertErr } = await admin.from("webauthn_credentials").insert({
    user_id: opts.userId,
    credential_id: credential.id,
    public_key: Buffer.from(credential.publicKey).toString("base64"),
    counter: credential.counter,
    transports: credential.transports ?? [],
    device_name: opts.deviceName ?? null,
  });
  if (insertErr) {
    throw new Error(`Could not save passkey: ${insertErr.message}`);
  }

  return { ok: true as const };
}

export async function buildAuthenticationOptions(opts: { userId: string }) {
  const credentials = await listUserCredentials(opts.userId);
  if (credentials.length === 0) {
    throw new Error("No registered passkeys for this user");
  }

  const options = await generateAuthenticationOptions({
    rpID: env.RP_ID,
    userVerification: "required",
    allowCredentials: credentials.map((c) => ({
      id: c.credential_id,
      transports: (c.transports ?? []) as AuthenticatorTransport[],
    })),
  });

  await persistChallenge({
    userId: opts.userId,
    challenge: options.challenge,
    purpose: "authenticate",
  });

  return options;
}

export async function verifyAuthentication(opts: {
  userId: string;
  response: AuthenticationResponseJSON;
}) {
  const consumed = await consumeChallenge({
    userId: opts.userId,
    purpose: "authenticate",
  });
  if (consumed.challenge === null) {
    throw new Error(
      consumed.reason === "expired"
        ? "Authentication challenge expired. Please try again."
        : "No authentication challenge found. Please start again.",
    );
  }

  const admin = createAdminClient();
  const { data: cred } = await admin
    .from("webauthn_credentials")
    .select("id, credential_id, public_key, counter, transports")
    .eq("user_id", opts.userId)
    .eq("credential_id", opts.response.id)
    .maybeSingle();
  if (!cred) throw new Error("Unknown credential");

  const verification = await verifyAuthenticationResponse({
    response: opts.response,
    expectedChallenge: consumed.challenge,
    expectedOrigin: env.RP_ORIGIN,
    expectedRPID: env.RP_ID,
    credential: {
      id: cred.credential_id,
      publicKey: new Uint8Array(Buffer.from(cred.public_key, "base64")),
      counter: Number(cred.counter ?? 0),
      transports: (cred.transports ?? []) as AuthenticatorTransport[],
    },
    requireUserVerification: true,
  });

  if (!verification.verified) {
    throw new Error("Authentication verification failed");
  }

  await admin
    .from("webauthn_credentials")
    .update({
      counter: verification.authenticationInfo.newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", cred.id);

  return { ok: true as const };
}

export async function userHasPasskey(userId: string): Promise<boolean> {
  const creds = await listUserCredentials(userId);
  return creds.length > 0;
}

export async function deleteAllUserCredentials(userId: string) {
  const admin = createAdminClient();
  await admin.from("webauthn_credentials").delete().eq("user_id", userId);
}
