import { requireUser } from "@/lib/session";
import { listUsers, ownershipByUser } from "@/features/users/user.service";
import { serialize } from "@/lib/serialize";
import UsersView, { type UserRow } from "@/components/views/UsersView";

export default async function UsersPage() {
  const user = await requireUser();
  const [rows, owned] = await Promise.all([listUsers(user), ownershipByUser(user)]);

  // folded in here rather than counted per row in the client, so the delete
  // dialog can say what it is about to move without another round trip
  const withOwned = (rows as any[]).map((r) => ({
    ...r,
    owned: owned[String(r._id)] ?? { projects: 0, partners: 0, proposals: 0 },
  }));

  return <UsersView rows={serialize(withOwned) as unknown as UserRow[]} currentUserId={user.id} />;
}
