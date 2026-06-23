import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getMfaConfig, hasPassedSecondFactor } from "@/lib/auth/rbac";
import { VerifyClient } from "./VerifyClient";

export default async function LoginTotpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const config = await getMfaConfig();
  if (!config) redirect("/login");

  if (await hasPassedSecondFactor(user.id, config)) redirect("/dashboard");

  if (!config.totpEnabled) {
    redirect(config.emailEnabled ? "/login/email" : "/onboarding/method");
  }

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp?.[0]!;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Enter your 6-digit code</CardTitle>
          <CardDescription>
            Open your authenticator app and enter the code for{" "}
            {totp.friendly_name ?? "this account"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <VerifyClient factorId={totp.id} />
          {config.emailEnabled && (
            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have your authenticator?{" "}
              <Link className="text-primary underline" href="/login/email">
                Use email code instead
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
