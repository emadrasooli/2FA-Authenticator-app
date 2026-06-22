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
import { verifyEmail2faCookie } from "@/lib/auth/email-2fa-session";
import { EmailCodeClient } from "./EmailCodeClient";

export default async function LoginEmailPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Already cleared the second factor by either mechanism → straight in.
  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2") redirect("/dashboard");
  if (await verifyEmail2faCookie(user.id)) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/login");

  // Offer the authenticator fallback only if the user has actually enrolled one.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasAuthenticator = (factors?.totp?.length ?? 0) > 0;

  // Issue the code on render. If it fails the user can still click "Resend".
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
          {hasAuthenticator && (
            <p className="text-center text-sm text-muted-foreground">
              Prefer your app?{" "}
              <Link className="text-primary underline" href="/login/totp">
                Use authenticator app instead
              </Link>
            </p>
          )}
          <p className="text-center text-sm text-muted-foreground">
            <Link className="underline" href="/login">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
