"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";

export function PasskeyLoginClient({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handle() {
    setBusy(true);
    setError(null);
    try {
      const optsRes = await fetch("/api/webauthn/authenticate/options", {
        method: "POST",
      });
      if (!optsRes.ok) throw new Error("Failed to start authentication");
      const options = await optsRes.json();

      const assertion = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch("/api/webauthn/authenticate/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: assertion }),
      });
      if (!verifyRes.ok) {
        const body = await verifyRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Verification failed");
      }
      const { redirectTo } = await verifyRes.json();
      router.replace(redirectTo ?? next ?? "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Passkey step failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button className="w-full" onClick={handle} disabled={busy}>
        {busy ? "Waiting for device…" : "Use passkey"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
