function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
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
  RP_ID: process.env.NEXT_PUBLIC_RP_ID ?? "localhost",
  RP_NAME: process.env.NEXT_PUBLIC_RP_NAME ?? "University 2FA",
  RP_ORIGIN: (process.env.NEXT_PUBLIC_RP_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};
