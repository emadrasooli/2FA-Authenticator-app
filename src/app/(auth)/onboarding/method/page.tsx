import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { MethodChoiceClient } from "./MethodChoiceClient";

export default async function MethodChoicePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Choose how you want to receive your 2FA code</CardTitle>
          <CardDescription>
            You can change this later from your account settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MethodChoiceClient />
        </CardContent>
      </Card>
    </main>
  );
}
