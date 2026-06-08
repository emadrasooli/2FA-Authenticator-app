"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasskeyOnboardingClient() {
  const router = useRouter();
  const [deviceName, setDeviceName] = useState("My device");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handle() {
    setBusy(true);
    setError(null);
    try {
      const optsRes = await fetch("/api/webauthn/register/options", {
        method: "POST",
      });
      if (!optsRes.ok) throw new Error("Could not start registration");
      const options = await optsRes.json();

      const attestation = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch("/api/webauthn/register/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: attestation, deviceName }),
      });
      if (!verifyRes.ok) {
        const body = await verifyRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Registration failed");
      }
      const { redirectTo } = await verifyRes.json();
      router.replace(redirectTo ?? "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register passkey");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="deviceName">Device name (optional)</Label>
        <Input
          id="deviceName"
          value={deviceName}
          onChange={(e) => setDeviceName(e.target.value)}
          placeholder="e.g. My MacBook"
        />
      </div>
      <Button className="w-full" onClick={handle} disabled={busy}>
        {busy ? "Waiting for device…" : "Register passkey"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
