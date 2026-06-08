import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { PasskeyLoginClient } from "./PasskeyLoginClient";

export default async function PasskeyLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const next = (await searchParams).next ?? "";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Verify with your passkey</CardTitle>
          <CardDescription>
            Use your fingerprint, Face ID, or Windows Hello to complete sign-in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasskeyLoginClient next={next} />
        </CardContent>
      </Card>
    </main>
  );
}
