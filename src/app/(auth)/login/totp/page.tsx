import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireMfaGate } from "@/lib/auth/rbac";
import { VerifyClient } from "./VerifyClient";

export default async function LoginTotpPage() {
  const { config, passed, totpFactor } = await requireMfaGate();
  if (passed) redirect("/dashboard");

  if (!config.totpEnabled || !totpFactor) {
    if (config.passkeyEnabled) redirect("/login/passkey");
    if (config.emailEnabled) redirect("/login/email");
    redirect("/onboarding/method");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Enter your 6-digit code</CardTitle>
          <CardDescription>
            Open your authenticator app and enter the code for{" "}
            {totpFactor.friendlyName ?? "this account"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <VerifyClient factorId={totpFactor.id} />
          <div className="space-y-1 text-center text-sm text-muted-foreground">
            {config.passkeyEnabled && (
              <p>
                <Link className="text-primary underline" href="/login/passkey">
                  Use this device&apos;s passkey instead
                </Link>
              </p>
            )}
            {config.emailEnabled && (
              <p>
                <Link className="text-primary underline" href="/login/email">
                  Email me a code instead
                </Link>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
