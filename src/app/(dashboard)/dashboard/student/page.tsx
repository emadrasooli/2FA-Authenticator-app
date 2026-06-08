import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/rbac";

export default async function StudentDashboard() {
  const user = await requireRole("student");
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Welcome, {user.full_name}</h1>
        <p className="text-muted-foreground">Student dashboard</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Your enrollments</CardTitle>
          <CardDescription>Course enrollment is coming soon.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
        </CardContent>
      </Card>
    </section>
  );
}
