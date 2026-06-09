import Link from "next/link";
import { requireFullyAuthed } from "@/lib/auth/rbac";
import { LogoutButton } from "@/components/LogoutButton";
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
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">
              {user.full_name} · <span className="capitalize">{user.role}</span>
            </span>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
