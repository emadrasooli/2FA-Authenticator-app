"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import { Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EnrollClient({ makePrimary }: { makePrimary: boolean }) {
  const router = useRouter();
  const [deviceName, setDeviceName] = useState("This device");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setPending(true);
    setError(null);
    try {
      const optsRes = await fetch("/api/webauthn/register-options", {
        method: "POST",
      });
      if (!optsRes.ok) throw new Error("Could not start setup");
      const optionsJSON = await optsRes.json();

      const attestation = await startRegistration({ optionsJSON });

      const verifyRes = await fetch("/api/webauthn/register-verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          response: attestation,
          deviceName,
          makePreferred: makePrimary,
        }),
      });
      if (!verifyRes.ok) {
        const body = await verifyRes.json().catch(() => null);
        throw new Error(body?.error ?? "Verification failed");
      }
      router.replace("/dashboard/settings");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="deviceName">Device name</Label>
        <Input
          id="deviceName"
          value={deviceName}
          onChange={(e) => setDeviceName(e.target.value)}
          placeholder="My laptop"
        />
      </div>
      <Button className="w-full" onClick={go} disabled={pending}>
        <Fingerprint className="mr-2 h-4 w-4" />
        {pending ? "Waiting for your device…" : "Bind this device"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
