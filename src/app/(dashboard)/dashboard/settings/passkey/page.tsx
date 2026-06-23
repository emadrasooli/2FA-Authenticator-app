import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireFullyAuthed, getMfaConfig } from "@/lib/auth/rbac";
import { EnrollClient } from "./EnrollClient";

export default async function SettingsPasskeyPage({
  searchParams,
}: {
  searchParams: Promise<{ primary?: string }>;
}) {
  await requireFullyAuthed();
  const makePrimary = (await searchParams).primary === "1";
  const config = await getMfaConfig();
  if (config?.passkeyEnabled) {
    redirect("/dashboard/settings");
  }

  return (
    <section className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Set up passkey / fingerprint</CardTitle>
          <CardDescription>
            Your browser will pop up a Windows Hello / Touch ID / fingerprint
            prompt. Confirm to bind this device to your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EnrollClient makePrimary={makePrimary} />
        </CardContent>
      </Card>
    </section>
  );
}
