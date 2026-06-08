import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/rbac";

export default async function TeacherDashboard() {
  const user = await requireRole("teacher");
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Welcome, {user.full_name}</h1>
        <p className="text-muted-foreground">Teacher dashboard</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Your courses</CardTitle>
          <CardDescription>Course management is coming soon.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No courses yet.</p>
        </CardContent>
      </Card>
    </section>
  );
}
