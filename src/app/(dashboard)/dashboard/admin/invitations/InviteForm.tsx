"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createInviteAction, type InviteState } from "./actions";

export function InviteForm() {
  const [state, formAction, pending] = useActionState<InviteState, FormData>(
    createInviteAction,
    undefined,
  );

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-[1fr_180px_auto]">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <select
          id="role"
          name="role"
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          defaultValue="student"
          required
        >
          <option value="student">Student</option>
          <option value="teacher">Teacher</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create invite"}
        </Button>
      </div>
      {state?.error && (
        <p className="text-sm text-destructive sm:col-span-3">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-sm text-primary sm:col-span-3">{state.success}</p>
      )}
    </form>
  );
}
