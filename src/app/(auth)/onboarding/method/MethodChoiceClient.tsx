"use client";

import { useActionState } from "react";
import { Smartphone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chooseMethodAction, type ChooseMethodState } from "./actions";

export function MethodChoiceClient() {
  const [state, formAction, pending] = useActionState<ChooseMethodState, FormData>(
    chooseMethodAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-3">
      <button
        type="submit"
        name="method"
        value="totp"
        disabled={pending}
        className="w-full rounded-lg border border-border bg-background p-4 text-left transition hover:border-primary hover:bg-muted disabled:opacity-50"
      >
        <div className="flex items-start gap-3">
          <Smartphone className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <div className="font-medium">Authenticator app</div>
            <div className="text-sm text-muted-foreground">
              Google Authenticator, Authy, 1Password, etc. Works offline; most secure.
            </div>
          </div>
        </div>
      </button>

      <button
        type="submit"
        name="method"
        value="email"
        disabled={pending}
        className="w-full rounded-lg border border-border bg-background p-4 text-left transition hover:border-primary hover:bg-muted disabled:opacity-50"
      >
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <div className="font-medium">Email code</div>
            <div className="text-sm text-muted-foreground">
              We email a 6-digit code each time you sign in. Simpler, no app needed.
            </div>
          </div>
        </div>
      </button>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
