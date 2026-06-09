import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VerifyForm } from "./VerifyForm";

export default function ForgotVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Check your inbox</CardTitle>
          <CardDescription>
            If an account exists for that email, a 6-digit code is on its way.
            Enter it below to verify and reset your authenticator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VerifyForm searchParamsPromise={searchParams} />
        </CardContent>
      </Card>
    </main>
  );
}
