function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// For WebAuthn, derive the Relying Party id/origin from APP_URL by default so
// the user only has to set one URL. They can override via NEXT_PUBLIC_RP_*.
function defaultRpId() {
  try {
    return new URL(appUrl).hostname;
  } catch {
    return "localhost";
  }
}

export const env = {
  SUPABASE_URL: required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  SUPABASE_ANON_KEY: required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  APP_URL: appUrl,

  // WebAuthn relying-party config.
  RP_ID: process.env.NEXT_PUBLIC_RP_ID ?? defaultRpId(),
  RP_NAME: process.env.NEXT_PUBLIC_RP_NAME ?? "University Portal",
  RP_ORIGIN: process.env.NEXT_PUBLIC_RP_ORIGIN ?? appUrl,
};
