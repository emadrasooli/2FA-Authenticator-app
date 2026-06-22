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
import { requireFullyAuthed } from "@/lib/auth/rbac";
import { createClient } from "@/lib/supabase/server";
import { MethodSettings } from "./MethodSettings";
import { RemoveAuthenticatorButton } from "./RemoveAuthenticatorButton";

export default async function SettingsPage() {
  const user = await requireFullyAuthed();
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasAuthenticator = (factors?.totp?.length ?? 0) > 0;

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage how you complete two-factor authentication.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Primary 2FA method</CardTitle>
          <CardDescription>
            This is what you&apos;re asked for first at sign-in. The other method
            is always available as a fallback.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MethodSettings
            current={user.mfa_method}
            hasAuthenticator={hasAuthenticator}
          />
        </CardContent>
      </Card>

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
          {hasAuthenticator ? (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4" /> Enabled
              </span>
              <RemoveAuthenticatorButton />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Not set up</span>
              <Link href="/dashboard/settings/authenticator">
                <Button size="sm">Set up authenticator</Button>
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
          <span className="flex items-center gap-2 text-sm text-primary">
            <CheckCircle2 className="h-4 w-4" /> Always available
          </span>
        </CardContent>
      </Card>
    </section>
  );
}
