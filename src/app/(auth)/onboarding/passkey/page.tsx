import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { PasskeyOnboardingClient } from "./PasskeyOnboardingClient";

export default async function OnboardingPasskeyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Set up your passkey</CardTitle>
          <CardDescription>
            Register this device&apos;s biometric (fingerprint / Face ID / Windows Hello).
            You will use it on every sign-in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasskeyOnboardingClient />
        </CardContent>
      </Card>
    </main>
  );
}
