import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { issueEmailOtp } from "@/lib/auth/email-otp";
import { getMfaConfig, hasPassedSecondFactor } from "@/lib/auth/rbac";
import { EmailCodeClient } from "./EmailCodeClient";

export default async function LoginEmailPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const config = await getMfaConfig();
  if (!config) redirect("/login");

  if (await hasPassedSecondFactor(user.id, config)) redirect("/dashboard");

  if (!config.emailEnabled) {
    if (config.totpEnabled) redirect("/login/totp");
    if (config.passkeyEnabled) redirect("/login/passkey");
    redirect("/onboarding/method");
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/login");

  const issued = await issueEmailOtp({ userId: user.id, email: profile.email });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent a code to <strong>{profile.email}</strong>. It expires in 10
            minutes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!issued.ok && (
            <p className="text-sm text-destructive">
              {issued.reason === "not-configured"
                ? "Email sending is not configured. Ask an admin to set RESEND_API_KEY."
                : "Could not send the code. Try resending below."}
            </p>
          )}
          <EmailCodeClient />
          <div className="space-y-1 text-center text-sm text-muted-foreground">
            {config.passkeyEnabled && (
              <p>
                <Link className="text-primary underline" href="/login/passkey">
                  Use this device&apos;s passkey instead
                </Link>
              </p>
            )}
            {config.totpEnabled && (
              <p>
                <Link className="text-primary underline" href="/login/totp">
                  Use authenticator app instead
                </Link>
              </p>
            )}
            <p>
              <Link className="underline" href="/login">
                Back to sign in
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
