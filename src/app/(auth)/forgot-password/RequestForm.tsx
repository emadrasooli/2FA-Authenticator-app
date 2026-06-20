"use client";

import { use, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  requestPasswordResetAction,
  type ForgotPasswordState,
} from "./actions";

export function RequestForm({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ sent?: string; email?: string }>;
}) {
  const params = use(searchParamsPromise);
  const [state, formAction, pending] = useActionState<
    ForgotPasswordState,
    FormData
  >(requestPasswordResetAction, undefined);

  if (params.sent) {
    return (
      <div className="space-y-3 text-sm">
        <p>
          If an account exists for <strong>{params.email}</strong>, a password
          reset link is on its way.
        </p>
        <p className="text-muted-foreground">
          Check your inbox (and spam folder). The link expires in 1 hour.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
        />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
