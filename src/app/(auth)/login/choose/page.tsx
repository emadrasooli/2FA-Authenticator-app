import Link from "next/link";
import { redirect } from "next/navigation";
import { Smartphone, Mail } from "lucide-react";
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

export default async function LoginChoosePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const config = await getMfaConfig();
  if (!config) redirect("/login");

  // Already past 2FA → go.
  if (await hasPassedSecondFactor(user.id, config)) redirect("/dashboard");

  // Need exactly TWO enabled to land here. Otherwise dispatch to the only one.
  if (!config.totpEnabled || !config.emailEnabled) {
    if (config.totpEnabled) redirect("/login/totp");
    if (config.emailEnabled) redirect("/login/email");
    redirect("/onboarding/method");
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .maybeSingle();

  const totpFirst = config.preferred === "totp";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Choose a 2FA method</CardTitle>
          <CardDescription>
            Both methods are enabled on your account. Pick one to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <MethodLink
            href="/login/totp"
            icon={<Smartphone className="mt-0.5 h-5 w-5 text-primary" />}
            title="Authenticator app"
            subtitle="Enter the 6-digit code from your app."
            featured={totpFirst}
          />
          <MethodLink
            href="/login/email"
            icon={<Mail className="mt-0.5 h-5 w-5 text-primary" />}
            title="Email code"
            subtitle={`Email a code to ${profile?.email ?? "your account"}.`}
            featured={!totpFirst}
          />
        </CardContent>
      </Card>
    </main>
  );
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
