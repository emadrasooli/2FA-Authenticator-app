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
import { PasskeyLoginClient } from "./PasskeyLoginClient";

export default async function LoginPasskeyPage() {
  const { config, passed } = await requireMfaGate();
  if (passed) redirect("/dashboard");

  if (!config.passkeyEnabled) {
    if (config.totpEnabled) redirect("/login/totp");
    if (config.emailEnabled) redirect("/login/email");
    redirect("/onboarding/method");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Use your device</CardTitle>
          <CardDescription>
            Touch the fingerprint reader, look at the camera, or confirm with
            Windows Hello / Touch ID. Your browser will pop up a prompt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PasskeyLoginClient />
          <div className="space-y-1 text-center text-sm text-muted-foreground">
            {config.totpEnabled && (
              <p>
                <Link className="text-primary underline" href="/login/totp">
                  Use authenticator app instead
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
