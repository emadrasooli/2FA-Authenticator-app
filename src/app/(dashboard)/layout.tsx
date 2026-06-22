import Link from "next/link";
import { requireFullyAuthed } from "@/lib/auth/rbac";
import { ProfileMenu } from "@/components/ProfileMenu";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireFullyAuthed();
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link href={`/dashboard/${user.role}`} className="font-semibold">
            University Portal
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <ThemeToggle />
            <ProfileMenu fullName={user.full_name} role={user.role} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
