import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RequestForm } from "./RequestForm";

export default function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; sent?: string }>;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Recover access</CardTitle>
          <CardDescription>
            Lost your authenticator app? We&apos;ll email a 6-digit code to your
            account address. After verifying it, you can register a new
            authenticator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RequestForm searchParamsPromise={searchParams} />
        </CardContent>
      </Card>
    </main>
  );
}
