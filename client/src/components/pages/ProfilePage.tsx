import { requireUser } from "@/lib/session";
import { getMyProfile } from "@/features/users/user.service";
import { serialize } from "@/lib/serialize";
import ProfileView, { type Profile } from "@/components/views/ProfileView";

/** Every role reaches this through its own area — /admin, /sales and /ops. */
export default async function ProfilePage() {
  const user = await requireUser();
  const me = await getMyProfile(user);

  // the session is the fallback if the row has since been removed underneath us
  const initial: Profile = {
    name: (me as any)?.name ?? user.name,
    username: (me as any)?.username ?? user.username,
    email: (me as any)?.email ?? "",
    role: (me as any)?.role ?? user.role,
  };

  return <ProfileView initial={serialize(initial) as unknown as Profile} />;
}
