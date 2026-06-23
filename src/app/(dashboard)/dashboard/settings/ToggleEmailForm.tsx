"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleEmailMethodAction, type SettingsState } from "./actions";

export function ToggleEmailForm({
  enabled,
  canDisable,
}: {
  enabled: boolean;
  canDisable: boolean;
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    toggleEmailMethodAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
      <div className="flex items-center justify-between">
        {enabled ? (
          <span className="flex items-center gap-2 text-sm text-primary">
            <CheckCircle2 className="h-4 w-4" /> Enabled
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Disabled</span>
        )}
        <Button
          type="submit"
          size="sm"
          variant={enabled ? "outline" : "default"}
          disabled={pending || (enabled && !canDisable)}
          title={
            enabled && !canDisable
              ? "Enable the authenticator app first"
              : undefined
          }
        >
          {pending ? "Saving…" : enabled ? "Disable" : "Enable"}
        </Button>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-primary">{state.success}</p>}
    </form>
  );
}
