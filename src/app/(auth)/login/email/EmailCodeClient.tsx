"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  resendEmailCodeAction,
  verifyEmailCodeAction,
  type EmailCodeState,
} from "./actions";

export function EmailCodeClient() {
  const [verifyState, verifyAction, verifyPending] = useActionState<
    EmailCodeState,
    FormData
  >(verifyEmailCodeAction, undefined);
  const [resendState, resendAction, resendPending] = useActionState<
    EmailCodeState,
    FormData
  >(resendEmailCodeAction, undefined);

  return (
    <div className="space-y-4">
      <form action={verifyAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="code">6-digit code</Label>
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
        {verifyState?.error && (
          <p className="text-sm text-destructive">{verifyState.error}</p>
        )}
        <Button type="submit" className="w-full" disabled={verifyPending}>
          {verifyPending ? "Verifying…" : "Verify"}
        </Button>
      </form>

      <form action={resendAction}>
        <Button
          type="submit"
          variant="outline"
          className="w-full"
          disabled={resendPending}
        >
          {resendPending ? "Sending…" : "Resend code"}
        </Button>
        {resendState?.info && (
          <p className="mt-2 text-sm text-primary">{resendState.info}</p>
        )}
        {resendState?.error && (
          <p className="mt-2 text-sm text-destructive">{resendState.error}</p>
        )}
      </form>
    </div>
  );
}
