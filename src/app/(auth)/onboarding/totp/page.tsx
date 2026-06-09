import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { EnrollClient } from "./EnrollClient";

export default async function OnboardingTotpPage() {
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
  if ((factors?.totp?.length ?? 0) > 0) {
    redirect("/login/totp");
  }

  const { data: enrolled, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Authenticator (${new Date().toISOString().slice(0, 10)})`,
  });

  if (error || !enrolled) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Could not start enrollment</CardTitle>
            <CardDescription>{error?.message ?? "Try again."}</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Set up your authenticator app</CardTitle>
          <CardDescription>
            Scan the QR code with Google Authenticator, Authy, Microsoft
            Authenticator, or 1Password — then enter the 6-digit code it shows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EnrollClient
            factorId={enrolled.id}
            qrCode={enrolled.totp.qr_code}
            secret={enrolled.totp.secret}
          />
        </CardContent>
      </Card>
    </main>
  );
}
