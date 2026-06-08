import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./LoginForm";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Use your university account. You will be asked for your passkey next.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm searchParamsPromise={searchParams} />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Have an invite link?{" "}
            <Link className="text-primary underline" href="/signup">
              Create your account
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
