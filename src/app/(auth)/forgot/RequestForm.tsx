"use client";

import { use, useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestRecoveryAction, type ForgotState } from "./actions";

export function RequestForm({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ email?: string; sent?: string }>;
}) {
  const params = use(searchParamsPromise);
  const [state, formAction, pending] = useActionState<ForgotState, FormData>(
    requestRecoveryAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Account email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={params.email ?? ""}
          required
        />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Email me a code"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link className="underline" href="/login">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
