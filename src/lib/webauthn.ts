import "server-only";

import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/types";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

type ChallengeType = "register" | "authenticate";

async function saveChallenge(opts: {
  userId?: string | null;
  email?: string | null;
  challenge: string;
  type: ChallengeType;
}) {
  const admin = createAdminClient();
  // Clean up old challenges for this principal.
  if (opts.userId) {
    await admin
      .from("webauthn_challenges")
      .delete()
      .eq("user_id", opts.userId)
      .eq("type", opts.type);
  } else if (opts.email) {
    await admin
      .from("webauthn_challenges")
      .delete()
      .eq("email", opts.email)
      .eq("type", opts.type);
  }
  await admin.from("webauthn_challenges").insert({
    user_id: opts.userId ?? null,
    email: opts.email ?? null,
    challenge: opts.challenge,
    type: opts.type,
  });
}

async function consumeChallenge(opts: {
  userId?: string | null;
  email?: string | null;
  type: ChallengeType;
}): Promise<string | null> {
  const admin = createAdminClient();
  let query = admin
    .from("webauthn_challenges")
    .select("id, challenge, expires_at")
    .eq("type", opts.type)
    .order("created_at", { ascending: false })
    .limit(1);
  if (opts.userId) query = query.eq("user_id", opts.userId);
  else if (opts.email) query = query.eq("email", opts.email);
  else return null;

  const { data } = await query.maybeSingle();
  if (!data) return null;
  await admin.from("webauthn_challenges").delete().eq("id", data.id);
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data.challenge;
}

export async function buildRegistrationOptions(opts: {
  userId: string;
  userName: string;
  displayName: string;
}): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("webauthn_credentials")
    .select("credential_id, transports")
    .eq("user_id", opts.userId);

  const options = await generateRegistrationOptions({
    rpName: env.RP_NAME,
    rpID: env.RP_ID,
    userID: new TextEncoder().encode(opts.userId),
    userName: opts.userName,
    userDisplayName: opts.displayName,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
    },
    excludeCredentials: (existing ?? []).map((c) => ({
      id: c.credential_id,
      transports: (c.transports ?? []) as AuthenticatorTransportFuture[],
    })),
  });

  await saveChallenge({
    userId: opts.userId,
    challenge: options.challenge,
    type: "register",
  });
  return options;
}

export async function verifyAndStoreRegistration(opts: {
  userId: string;
  response: RegistrationResponseJSON;
  deviceName?: string;
}): Promise<VerifiedRegistrationResponse> {
  const expected = await consumeChallenge({
    userId: opts.userId,
    type: "register",
  });
  if (!expected) throw new Error("No active registration challenge");

  const verification = await verifyRegistrationResponse({
    response: opts.response,
    expectedChallenge: expected,
    expectedOrigin: env.RP_ORIGIN,
    expectedRPID: env.RP_ID,
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Registration verification failed");
  }

  const { credential } = verification.registrationInfo;
  const admin = createAdminClient();
  await admin.from("webauthn_credentials").insert({
    user_id: opts.userId,
    credential_id: credential.id,
    public_key: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    transports: credential.transports ?? [],
    device_name: opts.deviceName ?? null,
  });

  return verification;
}

export async function buildAuthenticationOptions(opts: {
  userId: string;
}): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const admin = createAdminClient();
  const { data: creds } = await admin
    .from("webauthn_credentials")
    .select("credential_id, transports")
    .eq("user_id", opts.userId);

  const options = await generateAuthenticationOptions({
    rpID: env.RP_ID,
    userVerification: "required",
    allowCredentials: (creds ?? []).map((c) => ({
      id: c.credential_id,
      transports: (c.transports ?? []) as AuthenticatorTransportFuture[],
    })),
  });

  await saveChallenge({
    userId: opts.userId,
    challenge: options.challenge,
    type: "authenticate",
  });
  return options;
}

export async function verifyAuthentication(opts: {
  userId: string;
  response: AuthenticationResponseJSON;
}): Promise<VerifiedAuthenticationResponse> {
  const expected = await consumeChallenge({
    userId: opts.userId,
    type: "authenticate",
  });
  if (!expected) throw new Error("No active authentication challenge");

  const admin = createAdminClient();
  const { data: cred } = await admin
    .from("webauthn_credentials")
    .select("credential_id, public_key, counter, transports")
    .eq("user_id", opts.userId)
    .eq("credential_id", opts.response.id)
    .maybeSingle();

  if (!cred) throw new Error("Unknown credential");

  const verification = await verifyAuthenticationResponse({
    response: opts.response,
    expectedChallenge: expected,
    expectedOrigin: env.RP_ORIGIN,
    expectedRPID: env.RP_ID,
    credential: {
      id: cred.credential_id,
      publicKey: new Uint8Array(Buffer.from(cred.public_key, "base64url")),
      counter: Number(cred.counter),
      transports: (cred.transports ?? []) as AuthenticatorTransportFuture[],
    },
    requireUserVerification: true,
  });

  if (!verification.verified) throw new Error("Assertion failed");

  await admin
    .from("webauthn_credentials")
    .update({
      counter: verification.authenticationInfo.newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq("credential_id", opts.response.id);

  return verification;
}

export async function userHasPasskey(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("webauthn_credentials")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return (count ?? 0) > 0;
}

