import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">University Portal</h1>
      <p className="text-muted-foreground">
        Secure sign-in with email, password, and a 6-digit code from your authenticator app.
      </p>
      <div className="flex gap-3">
        <Link href="/login">
          <Button>Sign in</Button>
        </Link>
        <Link href="/signup">
          <Button variant="outline">I have an invite</Button>
        </Link>
      </div>
    </main>
  );
}
