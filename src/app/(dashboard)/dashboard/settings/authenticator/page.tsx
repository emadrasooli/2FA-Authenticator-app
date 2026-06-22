import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireFullyAuthed } from "@/lib/auth/rbac";
import { createClient } from "@/lib/supabase/server";
import { EnrollClient } from "./EnrollClient";

export default async function SettingsAuthenticatorPage({
  searchParams,
}: {
  searchParams: Promise<{ primary?: string }>;
}) {
  await requireFullyAuthed();
  const makePrimary = (await searchParams).primary === "1";
  const supabase = await createClient();

  // Already enrolled → nothing to do.
  const { data: existing } = await supabase.auth.mfa.listFactors();
  if ((existing?.totp?.length ?? 0) > 0) {
    redirect("/dashboard/settings");
  }

  const { data: enrolled, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Authenticator (${new Date().toISOString().slice(0, 10)})`,
  });

  if (error || !enrolled) {
    return (
      <section className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Could not start setup</CardTitle>
            <CardDescription>{error?.message ?? "Try again."}</CardDescription>
          </CardHeader>
        </Card>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Set up authenticator app</CardTitle>
          <CardDescription>
            Scan the QR code with your authenticator app, then enter the 6-digit
            code it shows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EnrollClient
            factorId={enrolled.id}
            qrCode={enrolled.totp.qr_code}
            secret={enrolled.totp.secret}
            makePrimary={makePrimary}
          />
        </CardContent>
      </Card>
    </section>
  );
}
