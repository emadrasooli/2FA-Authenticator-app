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
import { verifyEmail2faCookie } from "@/lib/auth/email-2fa-session";
import { VerifyClient } from "./VerifyClient";

export default async function LoginTotpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2") redirect("/dashboard");
  if (await verifyEmail2faCookie(user.id)) redirect("/dashboard");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp?.[0];
  // No authenticator enrolled → fall back to the always-available email code.
  if (!totp) redirect("/login/email");

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
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have your authenticator?{" "}
            <Link className="text-primary underline" href="/login/email">
              Use email code instead
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
