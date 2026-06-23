"use client";

import { useActionState } from "react";
import { Smartphone, Mail, Fingerprint } from "lucide-react";
import { setPreferredMethodAction, type SettingsState } from "./actions";
import type { MfaMethod } from "@/lib/auth/rbac";

export function DefaultMethodForm({
  current,
  totpEnabled,
  emailEnabled,
  passkeyEnabled,
}: {
  current: MfaMethod;
  totpEnabled: boolean;
  emailEnabled: boolean;
  passkeyEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    setPreferredMethodAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-3">
      {passkeyEnabled && (
        <Choice
          value="passkey"
          active={current === "passkey"}
          pending={pending}
          icon={<Fingerprint className="mt-0.5 h-5 w-5 text-primary" />}
          title="This device (passkey)"
        />
      )}
      {totpEnabled && (
        <Choice
          value="totp"
          active={current === "totp"}
          pending={pending}
          icon={<Smartphone className="mt-0.5 h-5 w-5 text-primary" />}
          title="Authenticator app"
        />
      )}
      {emailEnabled && (
        <Choice
          value="email"
          active={current === "email"}
          pending={pending}
          icon={<Mail className="mt-0.5 h-5 w-5 text-primary" />}
          title="Email code"
        />
      )}
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-primary">{state.success}</p>}
    </form>
  );
}

function Choice({
  value,
  active,
  pending,
  icon,
  title,
}: {
  value: "totp" | "email" | "passkey";
  active: boolean;
  pending: boolean;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="submit"
      name="method"
      value={value}
      disabled={pending || active}
      className={`w-full rounded-lg border p-3 text-left transition disabled:opacity-100 ${
        active
          ? "border-primary bg-primary/5"
          : "border-border bg-background hover:border-primary hover:bg-muted"
      }`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <div className="flex-1 font-medium">{title}</div>
        {active && (
          <span className="rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
            Default
          </span>
        )}
      </div>
    </button>
  );
}
