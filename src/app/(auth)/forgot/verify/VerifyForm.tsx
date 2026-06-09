"use client";

import { use, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  verifyRecoveryAction,
  type ForgotState,
} from "../actions";

export function VerifyForm({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ email?: string }>;
}) {
  const params = use(searchParamsPromise);
  const [state, formAction, pending] = useActionState<ForgotState, FormData>(
    verifyRecoveryAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="email" value={params.email ?? ""} />
      <div className="space-y-2">
        <Label htmlFor="email-display">Email</Label>
        <Input id="email-display" value={params.email ?? ""} disabled readOnly />
      </div>
      <div className="space-y-2">
        <Label htmlFor="token">6-digit code from email</Label>
        <Input
          id="token"
          name="token"
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
        {pending ? "Verifying…" : "Verify and re-enroll"}
      </Button>
    </form>
  );
}
