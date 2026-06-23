"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import { Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PasskeyLoginClient() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setPending(true);
    setError(null);
    try {
      const optsRes = await fetch("/api/webauthn/auth-options", {
        method: "POST",
      });
      if (!optsRes.ok) throw new Error("Could not start passkey ceremony");
      const optionsJSON = await optsRes.json();

      const authResp = await startAuthentication({ optionsJSON });

      const verifyRes = await fetch("/api/webauthn/auth-verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: authResp }),
      });
      if (!verifyRes.ok) {
        const body = await verifyRes.json().catch(() => null);
        throw new Error(body?.error ?? "Verification failed");
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button className="w-full" onClick={go} disabled={pending}>
        <Fingerprint className="mr-2 h-4 w-4" />
        {pending ? "Waiting for your device…" : "Use my fingerprint / passkey"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
