"use client";

import { useActionState } from "react";
import { Smartphone, Mail } from "lucide-react";
import { setPrimaryMethodAction, type SettingsState } from "./actions";
import type { MfaMethod } from "@/lib/auth/rbac";

export function MethodSettings({
  current,
  hasAuthenticator,
}: {
  current: MfaMethod;
  hasAuthenticator: boolean;
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    setPrimaryMethodAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-3">
      <MethodButton
        value="totp"
        active={current === "totp"}
        pending={pending}
        icon={<Smartphone className="mt-0.5 h-5 w-5 text-primary" />}
        title="Authenticator app"
        subtitle={
          hasAuthenticator
            ? "Use a code from your authenticator app first."
            : "Not set up yet — selecting this will start setup."
        }
      />
      <MethodButton
        value="email"
        active={current === "email"}
        pending={pending}
        icon={<Mail className="mt-0.5 h-5 w-5 text-primary" />}
        title="Email code"
        subtitle="Get a 6-digit code by email at sign-in."
      />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-primary">{state.success}</p>}
    </form>
  );
}

function MethodButton({
  value,
  active,
  pending,
  icon,
  title,
  subtitle,
}: {
  value: "totp" | "email";
  active: boolean;
  pending: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="submit"
      name="method"
      value={value}
      disabled={pending || active}
      className={`w-full rounded-lg border p-4 text-left transition disabled:opacity-100 ${
        active
          ? "border-primary bg-primary/5"
          : "border-border bg-background hover:border-primary hover:bg-muted"
      }`}
    >
      <div className="flex items-start gap-3">
        {icon}
        <div className="flex-1">
          <div className="flex items-center gap-2 font-medium">
            {title}
            {active && (
              <span className="rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                Primary
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground">{subtitle}</div>
        </div>
      </div>
    </button>
  );
}
