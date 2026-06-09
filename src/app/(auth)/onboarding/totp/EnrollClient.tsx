"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyEnrollmentAction, type EnrollState } from "./actions";

export function EnrollClient({
  factorId,
  qrCode,
  secret,
}: {
  factorId: string;
  qrCode: string;
  secret: string;
}) {
  const [state, formAction, pending] = useActionState<EnrollState, FormData>(
    verifyEnrollmentAction,
    undefined,
  );
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="space-y-5">
      <div
        className="mx-auto w-fit rounded-md bg-white p-3"
        dangerouslySetInnerHTML={{ __html: qrCode }}
      />

      <div className="space-y-2 text-center">
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          className="text-sm text-muted-foreground underline"
        >
          {revealed ? "Hide" : "Can&apos;t scan? Show secret"}
        </button>
        {revealed && (
          <code className="block break-all rounded bg-muted px-3 py-2 text-xs">
            {secret}
          </code>
        )}
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="factorId" value={factorId} />
        <div className="space-y-2">
          <Label htmlFor="code">6-digit code from your app</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            minLength={6}
            required
          />
        </div>
        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Verifying…" : "Verify and continue"}
        </Button>
      </form>
    </div>
  );
}
