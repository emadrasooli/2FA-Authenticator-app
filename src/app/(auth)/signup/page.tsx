import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { SignupForm } from "./SignupForm";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Invite required</CardTitle>
            <CardDescription>
              Sign-up is by invitation only. Please ask an administrator for a link.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("invitations")
    .select("email, role, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  const invalid =
    !invite ||
    invite.used_at ||
    new Date(invite.expires_at).getTime() < Date.now();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            {invalid
              ? "This invite link is invalid or has expired."
              : `Invited as ${invite.role} (${invite.email}).`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!invalid && <SignupForm token={token} email={invite!.email} />}
        </CardContent>
      </Card>
    </main>
  );
}
