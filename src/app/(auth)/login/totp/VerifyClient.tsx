"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyLoginTotpAction, type LoginTotpState } from "./actions";

export function VerifyClient({ factorId }: { factorId: string }) {
  const [state, formAction, pending] = useActionState<LoginTotpState, FormData>(
    verifyLoginTotpAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="factorId" value={factorId} />
      <div className="space-y-2">
        <Label htmlFor="code">Authentication code</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          minLength={6}
          autoFocus
          required
        />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Verifying…" : "Verify"}
      </Button>
    </form>
  );
}
