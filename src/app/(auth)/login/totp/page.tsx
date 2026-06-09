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
import { VerifyClient } from "./VerifyClient";

export default async function LoginTotpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2") {
    redirect("/dashboard");
  }

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp?.[0];
  if (!totp) {
    redirect("/onboarding/totp");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Enter your 6-digit code</CardTitle>
          <CardDescription>
            Open your authenticator app and enter the code for {totp.friendly_name ?? "this account"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <VerifyClient factorId={totp.id} />
          <p className="text-center text-sm text-muted-foreground">
            Lost access to your authenticator?{" "}
            <Link className="text-primary underline" href="/forgot">
              Recover via email
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
