import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/rbac";

export default async function AdminDashboard() {
  const user = await requireRole("admin");
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Welcome, {user.full_name}</h1>
        <p className="text-muted-foreground">Administrator dashboard</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Invitations</CardTitle>
            <CardDescription>Invite teachers and students to the portal.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/admin/invitations">
              <Button>Manage invitations</Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Users (coming soon)</CardTitle>
            <CardDescription>Browse and manage existing accounts.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </section>
  );
}
