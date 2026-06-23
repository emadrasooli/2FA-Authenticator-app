import Link from "next/link";
import { Smartphone, Mail, CheckCircle2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireFullyAuthed, getMfaConfig } from "@/lib/auth/rbac";
import { ToggleEmailForm } from "./ToggleEmailForm";
import { RemoveAuthenticatorButton } from "./RemoveAuthenticatorButton";
import { DefaultMethodForm } from "./DefaultMethodForm";

export default async function SettingsPage() {
  const user = await requireFullyAuthed();
  const config = (await getMfaConfig())!;

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your two-factor authentication methods.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Authenticator app
          </CardTitle>
          <CardDescription>
            Google Authenticator, Authy, 1Password, etc.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {config.totpEnabled ? (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4" /> Enabled
              </span>
              <RemoveAuthenticatorButton />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Disabled</span>
              <Link href="/dashboard/settings/authenticator">
                <Button size="sm">Enable</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Email code
          </CardTitle>
          <CardDescription>
            A 6-digit code sent to <strong>{user.email}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleEmailForm
            enabled={config.emailEnabled}
            canDisable={config.totpEnabled}
          />
        </CardContent>
      </Card>

      {config.totpEnabled && config.emailEnabled && (
        <Card>
          <CardHeader>
            <CardTitle>Default at sign-in</CardTitle>
            <CardDescription>
              Which method to suggest first when both are enabled. You can always
              switch on the sign-in screen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DefaultMethodForm current={config.preferred} />
          </CardContent>
        </Card>
      )}
    </section>
  );
}
