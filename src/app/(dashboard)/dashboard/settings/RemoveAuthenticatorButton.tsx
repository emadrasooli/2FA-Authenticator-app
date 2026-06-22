"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { removeAuthenticatorAction, type SettingsState } from "./actions";

export function RemoveAuthenticatorButton() {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    removeAuthenticatorAction,
    undefined,
  );

  if (!confirming) {
    return (
      <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
        Remove
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Remove it?</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setConfirming(false)}
        disabled={pending}
      >
        Cancel
      </Button>
      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        {pending ? "Removing…" : "Confirm"}
      </Button>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
