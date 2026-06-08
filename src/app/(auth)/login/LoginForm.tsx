"use client";

import { use, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ next?: string; error?: string }>;
}) {
  const params = use(searchParamsPromise);
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={params.next ?? ""} />
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
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
        />
      </div>
      {(state?.error || params.error) && (
        <p className="text-sm text-destructive">{state?.error ?? params.error}</p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Continue"}
      </Button>
    </form>
  );
}
