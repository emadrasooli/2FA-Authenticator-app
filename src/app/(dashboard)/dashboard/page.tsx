import { redirect } from "next/navigation";
import { requireFullyAuthed } from "@/lib/auth/rbac";

export default async function DashboardIndex() {
  const user = await requireFullyAuthed();
  redirect(`/dashboard/${user.role}`);
}
