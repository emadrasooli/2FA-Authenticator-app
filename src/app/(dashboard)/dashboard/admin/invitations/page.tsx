import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { InviteForm } from "./InviteForm";

export default async function InvitationsPage() {
  await requireRole("admin");
  const admin = createAdminClient();
  const { data: invites } = await admin
    .from("invitations")
    .select("id, email, role, token, expires_at, used_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Invitations</h1>
        <p className="text-muted-foreground">
          Create single-use invite links for new users.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>New invitation</CardTitle>
          <CardDescription>The link is valid for 7 days.</CardDescription>
        </CardHeader>
        <CardContent>
          <InviteForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent invitations</CardTitle>
        </CardHeader>
        <CardContent>
          {!invites || invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invitations yet.</p>
          ) : (
            <ul className="space-y-3">
              {invites.map((i) => {
                const link = `${env.APP_URL}/signup?token=${i.token}`;
                const status = i.used_at
                  ? "used"
                  : new Date(i.expires_at).getTime() < Date.now()
                  ? "expired"
                  : "active";
                return (
                  <li key={i.id} className="rounded border border-border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-medium">{i.email}</span>{" "}
                        <span className="text-muted-foreground">· {i.role}</span>
                      </div>
                      <span className="rounded bg-muted px-2 py-0.5 text-xs capitalize">
                        {status}
                      </span>
                    </div>
                    <div className="mt-2 break-all font-mono text-xs text-muted-foreground">
                      {link}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
