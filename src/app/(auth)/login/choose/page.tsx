import Link from "next/link";
import { redirect } from "next/navigation";
import { Fingerprint, Smartphone, Mail } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMfaConfig, hasPassedSecondFactor } from "@/lib/auth/rbac";
import type { MfaMethod } from "@/lib/auth/rbac";

export default async function LoginChoosePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const config = await getMfaConfig();
  if (!config) redirect("/login");

  if (await hasPassedSecondFactor(user.id, config)) redirect("/dashboard");

  const enabledCount =
    (config.totpEnabled ? 1 : 0) +
    (config.emailEnabled ? 1 : 0) +
    (config.passkeyEnabled ? 1 : 0);

  if (enabledCount < 2) {
    if (config.totpEnabled) redirect("/login/totp");
    if (config.passkeyEnabled) redirect("/login/passkey");
    if (config.emailEnabled) redirect("/login/email");
    redirect("/onboarding/method");
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Choose a 2FA method</CardTitle>
          <CardDescription>
            Multiple methods are enabled on your account. Pick one.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {config.passkeyEnabled && (
            <MethodLink
              href="/login/passkey"
              icon={<Fingerprint className="mt-0.5 h-5 w-5 text-primary" />}
              title="This device (passkey / fingerprint)"
              subtitle="Touch the sensor or confirm with Windows Hello / Touch ID."
              featured={isPreferred(config.preferred, "passkey")}
            />
          )}
          {config.totpEnabled && (
            <MethodLink
              href="/login/totp"
              icon={<Smartphone className="mt-0.5 h-5 w-5 text-primary" />}
              title="Authenticator app"
              subtitle="Enter the 6-digit code from your app."
              featured={isPreferred(config.preferred, "totp")}
            />
          )}
          {config.emailEnabled && (
            <MethodLink
              href="/login/email"
              icon={<Mail className="mt-0.5 h-5 w-5 text-primary" />}
              title="Email code"
              subtitle={`Email a code to ${profile?.email ?? "your account"}.`}
              featured={isPreferred(config.preferred, "email")}
            />
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function isPreferred(preferred: MfaMethod, this_one: MfaMethod) {
  return preferred === this_one;
}

function MethodLink({
  href,
  icon,
  title,
  subtitle,
  featured,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  featured: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-lg border p-4 transition ${
        featured
          ? "border-primary bg-primary/5"
          : "border-border bg-background hover:border-primary hover:bg-muted"
      }`}
    >
      <div className="flex items-start gap-3">
        {icon}
        <div>
          <div className="flex items-center gap-2 font-medium">
            {title}
            {featured && (
              <span className="rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                Default
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground">{subtitle}</div>
        </div>
      </div>
    </Link>
  );
}
